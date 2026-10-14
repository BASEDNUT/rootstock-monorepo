import { erc20Abi, type Address } from 'viem'
import type { GqlToken } from '@repo/lib/shared/services/api/graphql-derived-types'
import { getGqlChain } from '@repo/lib/config/app.config'
import { createDiscoveryClientFor, type DiscoveryClient } from '../pool/onchain-pool-fetch'
import { getOnchainScanConfig } from '../pool/onchain-pool-discovery'
import {
  FACTORY_SCAN_CHUNK,
  TOKEN_CREATED_TOPIC0,
  WRAPPER_CREATED_TOPIC0,
  getPrimitivesDeployment,
} from './primitives.config'
import {
  FACTORY_TOKENS_STORE_VERSION,
  loadFactoryTokensStore,
  mergeFactoryTokensStore,
  saveFactoryTokensStore,
  type FactoryTokenRecord,
  type FactoryTokensStore,
} from './factory-tokens-store'

/**
 * Rootstock: factory-deployed tokens + wrappers (BASESEP), discovered from
 * TokenCreated / WrapperCreated events — the PRD-07 pickers law. Metadata is
 * read directly onchain (erc20 name/symbol/decimals via one multicall).
 * Never the remote API (onchain-only law, ).
 *
 * Live-verified 2026-09-28: both factories carry real creations from the  * E2E walk (token 0x57d2…729c, wrapper 0xf64f…00fd).
 */

/** Raw log shape from eth_getLogs (house pattern, onchain-pool-fetch). */
interface RawLog {
  blockNumber: `0x${string}`
  topics: `0x${string}`[]
}

interface FactoryCreation {
  address: string
  blockNumber: number
}

/** topics[1] is the indexed token/wrapper address in both factory events. */
function creationFromLog(log: RawLog): FactoryCreation | null {
  const topic = log.topics?.[1]
  if (!topic) return null
  return {
    address: '0x' + topic.slice(-40),
    blockNumber: Number(BigInt(log.blockNumber)),
  }
}

function toHexBlock(n: bigint): `0x${string}` {
  return ('0x' + n.toString(16)) as `0x${string}`
}

/**
 * Raw eth_getLogs — viem's typed getLogs union rejects `topics`
 * (TS2353, same wall hit; house law = raw request).
 */
async function getLogsRaw(
  client: DiscoveryClient,
  factory: string,
  topic0: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<RawLog[]> {
  return (await client.request({
    method: 'eth_getLogs',
    params: [
      {
        address: factory as `0x${string}`,
        topics: [topic0 as `0x${string}`],
        fromBlock: toHexBlock(fromBlock),
        toBlock: toHexBlock(toBlock),
      },
    ],
  })) as RawLog[]
}

/**
 * Wide-range single-shot first (live-probe verified on sepolia.base.org with
 * address+topic filters); chunked fallback if the range is rejected .
 */
async function scanFactoryLogs(
  client: DiscoveryClient,
  factory: string,
  topic0: string,
  fromBlock: number,
  chunkSize: number
): Promise<{ logs: RawLog[]; scannedTo: number }> {
  const from = BigInt(fromBlock)
  const latest = await client.getBlockNumber()

  try {
    const logs = await getLogsRaw(client, factory, topic0, from, latest)
    return { logs, scannedTo: Number(latest) }
  } catch {
    // chunked fallback (house pattern, — 500-block range limit, live-observed 2026-10-06)
    const logs: RawLog[] = []

    for (let start = fromBlock; start <= Number(latest); start += chunkSize) {
      const end = Math.min(start + chunkSize - 1, Number(latest))
      const chunkLogs = await getLogsRaw(client, factory, topic0, BigInt(start), BigInt(end))
      logs.push(...chunkLogs)
    }

    return { logs, scannedTo: Number(latest) }
  }
}

export async function fetchOnchainFactoryTokens(chainId: number): Promise<GqlToken[]> {
  // Integration suite gate (same rationale as fetchDiscoveredPools).
  if (process.env.ROOTSTOCK_SKIP_ONCHAIN_SCANS === '1') return []

  // FIX-7 (F-02): per-chain scan — resolve the chain's primitive
  // factories + fromBlock + RPC from ITS deployment entry; scan THAT
  // chain with a per-chain client (was Sepolia-hardcoded discoveryClient()).
  const deployment = getPrimitivesDeployment(chainId)
  if (!deployment) return [] // no primitives deployed on this chain — honest zero

  const chain = getGqlChain(chainId as 8453 | 84532)
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig) throw new Error(`No onchain scan config for chain: ${chain}`)

  const client = createDiscoveryClientFor(scanConfig)

  // Incremental scan (auditor finding): refreshes scan only NEW blocks —
  // the persisted cursor + 1, never the factory deployment block again.
  // A store recorded against a different deployment identity (factory
  // redeploy, moved origin) is void and discarded on load. Environments
  // without localStorage (SSR/tests) scan from fromBlock as before.
  const identity = {
    chainId,
    tokenFactory: deployment.tokenFactory,
    wrapperFactory: deployment.wrapperFactory,
    fromBlock: deployment.fromBlock,
  }

  const store = loadFactoryTokensStore(identity)
  const scanStart = store ? store.cursor + 1 : deployment.fromBlock

  const [tokenScan, wrapperScan] = await Promise.all([
    scanFactoryLogs(
      client,
      deployment.tokenFactory,
      TOKEN_CREATED_TOPIC0,
      scanStart,
      FACTORY_SCAN_CHUNK
    ),
    scanFactoryLogs(
      client,
      deployment.wrapperFactory,
      WRAPPER_CREATED_TOPIC0,
      scanStart,
      FACTORY_SCAN_CHUNK
    ),
  ])

  // the block BOTH scans actually covered - the persisted cursor never runs
  // ahead of what was scanned (min, not max: two scans calling getBlockNumber
  // independently can see different heads on a tip advance; max would persist
  // a block one scan never covered and permanently skip it. Overlap from min
  // is idempotent via the address dedupe.)
  const scannedTo = Math.min(tokenScan.scannedTo, wrapperScan.scannedTo)

  const creations = [...tokenScan.logs, ...wrapperScan.logs]
    .map(creationFromLog)
    .filter((c): c is FactoryCreation => c !== null)

  // dedupe (idempotent rescans)
  const seen = new Set<string>()
  const list: Address[] = []

  for (const c of creations) {
    const key = c.address.toLowerCase()

    if (!seen.has(key)) {
      seen.add(key)
      list.push(c.address as Address)
    }
  }

  // Persisted records: ERC20 metadata is immutable and reused - reads run
  // only for addresses the store does not know yet, PLUS persisted records
  // whose metadata reads previously FAILED (incomplete) - they retry every
  // refresh until complete, instead of being lost forever behind the cursor.
  const knownRecords: FactoryTokenRecord[] = store ? Object.values(store.tokens) : []
  const knownByAddr = new Map(knownRecords.map(r => [r.address.toLowerCase(), r]))

  const incompleteRecords = knownRecords.filter(
    r => !r.name || !r.symbol || typeof r.decimals !== 'number'
  )

  // store records carry plain string addresses — multicall contracts require
  // the viem Address (0x-prefixed) form, so cast at the boundary
  const retryAddresses = incompleteRecords.map(r => r.address as Address)
  const newAddresses = [...list.filter(a => !knownByAddr.has(a.toLowerCase())), ...retryAddresses]

  // one multicall: 3 reads per NEW token (chain-correct client)
  const contracts = newAddresses.flatMap(address => [
    { address, abi: erc20Abi, functionName: 'name' as const },
    { address, abi: erc20Abi, functionName: 'symbol' as const },
    { address, abi: erc20Abi, functionName: 'decimals' as const },
  ])

  const results = contracts.length ? await client.multicall({ contracts, allowFailure: true }) : []

  const base = {
    __typename: 'GqlToken' as const,
    // FIX-7: chain/chainId tags derive from the parameter (was
    // BASESEP/84532-hardcoded).
    chain,
    chainId,
    logoURI: '',
    priority: 0,
    tradable: true,
    isErc4626: false,
    isBufferAllowed: false,
    coingeckoId: null as string | null,
    priceRateProviderData: null,
  }

  const tokens: GqlToken[] = []

  const blockByAddr = new Map(creations.map(c => [c.address.toLowerCase(), c.blockNumber]))

  // retried addresses (incomplete persisted records) are not in the current
  // scan window - keep their persisted block numbers
  for (const r of incompleteRecords) {
    if (!blockByAddr.has(r.address.toLowerCase())) {
      blockByAddr.set(r.address.toLowerCase(), r.blockNumber)
    }
  }

  const freshRecords: FactoryTokenRecord[] = []

  for (let i = 0; i < newAddresses.length; i++) {
    const name = results[i * 3]
    const symbol = results[i * 3 + 1]
    const decimals = results[i * 3 + 2]

    const address = newAddresses[i] as string

    if (
      !name ||
      !symbol ||
      !decimals ||
      name.status !== 'success' ||
      symbol.status !== 'success' ||
      decimals.status !== 'success' ||
      typeof name.result !== 'string' ||
      typeof symbol.result !== 'string' ||
      typeof decimals.result !== 'number'
    ) {
      // unreadable — persist the INCOMPLETE record (address + block) so the
      // next refresh retries its metadata (the incomplete-retry loop picks
      // it up) instead of losing the token forever behind the advanced cursor
      freshRecords.push({
        address,
        blockNumber: blockByAddr.get(address.toLowerCase()) ?? 0,
      })

      continue
    }

    freshRecords.push({
      address,
      blockNumber: blockByAddr.get(address.toLowerCase()) ?? 0,
      name: name.result,
      symbol: symbol.result,
      decimals: decimals.result,
    })

    tokens.push({
      ...base,
      address,
      name: name.result,
      symbol: symbol.result,
      decimals: decimals.result,
    })
  }

  // persisted records render from stored metadata - zero re-reads
  for (const record of knownRecords) {
    if (!record.name || !record.symbol || typeof record.decimals !== 'number') {
      continue // incomplete record - defensive skip, never guessed metadata
    }

    tokens.push({
      ...base,
      address: record.address,
      name: record.name,
      symbol: record.symbol,
      decimals: record.decimals,
    })
  }

  // Persist the cumulative registry + cursor: the next refresh scans only
  // NEW blocks (cursor + 1) and re-reads metadata only for NEW addresses.
  // Persistence failure never breaks the fetch - the tokens still return.
  try {
    const existingStore: FactoryTokensStore = store ?? {
      version: FACTORY_TOKENS_STORE_VERSION,
      chainId,
      tokenFactory: deployment.tokenFactory,
      wrapperFactory: deployment.wrapperFactory,
      fromBlock: deployment.fromBlock,
      cursor: scannedTo,
      savedAt: 0,
      tokens: {},
    }

    saveFactoryTokensStore(mergeFactoryTokensStore(existingStore, scannedTo, freshRecords))
  } catch {
    // ignore - in-memory result still returns
  }

  return tokens
}
