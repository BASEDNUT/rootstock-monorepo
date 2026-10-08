import { erc20Abi, type Address } from 'viem'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { GqlToken } from '@repo/lib/shared/services/api/graphql-derived-types'
import { discoveryClient } from '../pool/onchain-pool-fetch'
import {
  FACTORY_SCAN_CHUNK,
  FACTORY_SCAN_FROM_BLOCK,
  TOKEN_CREATED_TOPIC0,
  TOKEN_FACTORY,
  WRAPPER_CREATED_TOPIC0,
  WRAPPER_FACTORY,
} from './primitives.config'

/**
 * Rootstock: factory-deployed tokens + wrappers (BASESEP), discovered from
 * TokenCreated / WrapperCreated events — the PRD-07 pickers law. Metadata is
 * read directly onchain (erc20 name/symbol/decimals via one multicall).
 * Never the remote API (onchain-only law, S100).
 *
 * Live-verified 2026-09-28: both factories carry real creations from the S104
 * E2E walk (token 0x57d2…729c, wrapper 0xf64f…00fd).
 */

/** Raw log shape from eth_getLogs (house pattern, S100 onchain-pool-fetch). */
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
 * (TS2353, same wall S100 hit; house law = raw request).
 */
async function getLogsRaw(
  factory: string,
  topic0: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<RawLog[]> {
  const client = discoveryClient()
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
 * address+topic filters); chunked fallback if the range is rejected (S100).
 */
async function scanFactoryLogs(factory: string, topic0: string): Promise<RawLog[]> {
  const from = BigInt(FACTORY_SCAN_FROM_BLOCK)
  const latest = await discoveryClient().getBlockNumber()

  try {
    return await getLogsRaw(factory, topic0, from, latest)
  } catch {
    // chunked fallback (house pattern, S100 — 500-block range limit, live-observed 2026-10-06)
    const logs: RawLog[] = []

    for (
      let start = FACTORY_SCAN_FROM_BLOCK;
      start <= Number(latest);
      start += FACTORY_SCAN_CHUNK
    ) {
      const end = Math.min(start + FACTORY_SCAN_CHUNK - 1, Number(latest))
      const chunk = await getLogsRaw(factory, topic0, BigInt(start), BigInt(end))
      logs.push(...chunk)
    }

    return logs
  }
}

export async function fetchOnchainFactoryTokens(): Promise<GqlToken[]> {
  // Integration suite gate (same rationale as fetchDiscoveredPools).
  if (process.env.ROOTSTOCK_SKIP_ONCHAIN_SCANS === '1') return []

  const [tokenLogs, wrapperLogs] = await Promise.all([
    scanFactoryLogs(TOKEN_FACTORY, TOKEN_CREATED_TOPIC0),
    scanFactoryLogs(WRAPPER_FACTORY, WRAPPER_CREATED_TOPIC0),
  ])

  const creations = [...tokenLogs, ...wrapperLogs]
    .map(creationFromLog)
    .filter((c): c is FactoryCreation => c !== null)

  if (creations.length === 0) return []

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

  const client = discoveryClient()

  // one multicall: 3 reads per token
  const contracts = list.flatMap(address => [
    { address, abi: erc20Abi, functionName: 'name' as const },
    { address, abi: erc20Abi, functionName: 'symbol' as const },
    { address, abi: erc20Abi, functionName: 'decimals' as const },
  ])

  const results = await client.multicall({ contracts, allowFailure: true })

  const base = {
    __typename: 'GqlToken' as const,
    chain: GqlChainValues.BaseSepolia,
    chainId: 84532,
    logoURI: '',
    priority: 0,
    tradable: true,
    isErc4626: false,
    isBufferAllowed: false,
    coingeckoId: null as string | null,
    priceRateProviderData: null,
  }

  const tokens: GqlToken[] = []

  for (let i = 0; i < list.length; i++) {
    const name = results[i * 3]
    const symbol = results[i * 3 + 1]
    const decimals = results[i * 3 + 2]

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
      continue // unreadable token — skip
    }

    tokens.push({
      ...base,
      address: list[i] as string,
      name: name.result,
      symbol: symbol.result,
      decimals: decimals.result,
    })
  }

  return tokens
}
