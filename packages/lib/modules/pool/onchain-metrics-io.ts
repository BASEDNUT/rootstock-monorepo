/**
 * Rootstock onchain metrics — I/O layer.
 *
 * Fetches everything computePoolMetrics() needs:
 * - pool state: vault-fallback getPoolTokenInfo + getStaticSwapFeePercentage;
 *   pool-direct getNormalizedWeights (vault fallback reverts for weights)
 * - prices: GeckoTerminal multi-price (CORS-open, keyless; GT does not
 *   serve testnets — BASESEP honestly reports no prices)
 * - swap ledger: Vault Swap events (the ONLY full-fee source — see
 *   onchain-metrics.ts header) scanned in provider-range chunks
 *
 * RPC laws: publicnode serves ~10k-block recent windows on Base mainnet;
 * sepolia.base.org serves 500-block windows on BASESEP. The scan starts
 * from the ledger cursor — never from deploy block.
 */

import {
  SWAP_TOPIC0,
  decodeSwapLogsToBuckets,
  type SwapBucket,
  type MetricToken,
} from './onchain-metrics-topics'
import { getOnchainScanConfig } from './onchain-pool-discovery'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/** Per-pool onchain state needed for metrics. */
export interface PoolState {
  poolId: string
  tokens: MetricToken[]
  balancesRaw: bigint[]
  weights: number[] | null
  staticSwapFee: number | null
}

/** GT network id by chain. */
const GT_NETWORK: Partial<Record<GqlChain, string>> = {
  [GqlChainValues.Base]: 'base',
}

// Reuse the pinned discovery client factory — instantiating a second
// PublicClient generic here triggers TS2719 (two unrelated instantiations).
import { erc20Abi as erc20AbiImport } from 'viem'
import { createDiscoveryClientFor, type DiscoveryClient } from './onchain-pool-fetch'

/** Create a metrics reader for a chain (null when no scan config). */
export function createMetricsClient(chain: GqlChain): DiscoveryClient | null {
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig) return null
  return createDiscoveryClientFor(scanConfig)
}

/**
 * B1 (live-caught 2026-10-21): the metrics path must resolve token
 * decimals from the POOLS THEMSELVES — baked-registry poolTokens carry
 * ERC20 metadata — with an onchain erc20 multicall for anything still
 * unresolved. The caller-supplied decimalsByAddress comes from the
 * remote token catalog, which does not know Rootstock pool tokens;
 * treating unknown decimals as 18 zeroed SNUT(9)/cbBTC(8)/tBTC(8)/
 * EURC(6)/USDC(6)/NVDAc(8)/AAPLc(8) legs and halved pNUT TVL.
 */
export function resolveTokenDecimals(
  pools: { poolTokens: { address: string; decimals?: number }[] }[],
  callerDecimals: Record<string, number>
): { decimals: Record<string, number>; missing: string[] } {
  const decimals: Record<string, number> = {}
  const missing = new Set<string>()

  for (const pool of pools) {
    for (const token of pool.poolTokens || []) {
      const key = token.address.toLowerCase()
      if (!key) continue
      if (typeof token.decimals === 'number') {
        // registry truth wins — chain metadata beats any catalog guess
        decimals[key] = token.decimals
      } else if (!(key in decimals) && !(key in callerDecimals)) {
        missing.add(key)
      }
    }
  }

  for (const [key, value] of Object.entries(callerDecimals)) {
    if (!(key in decimals)) decimals[key] = value
  }

  return { decimals, missing: [...missing] }
}

/** Onchain erc20 decimals() fallback for unresolved tokens — never throws. */
type MulticallResult = { status: string; result?: unknown }

/**
 * Onchain erc20 decimals() fallback for unresolved tokens (B1). Accepts
 * any viem-shaped multicall client; failures inside results are skipped
 * and a thrown multicall returns {} — never fabricates.
 */
export async function fetchMissingTokenDecimals(
  client: { multicall(args: unknown): Promise<MulticallResult[]> },
  addresses: string[]
): Promise<Record<string, number>> {
  if (addresses.length === 0) return {}

  try {
    const results = await client.multicall({
      contracts: addresses.map(address => ({
        address: address as `0x${string}`,
        abi: erc20AbiImport,
        functionName: 'decimals' as const,
      })),
      allowFailure: true,
    })

    const out: Record<string, number> = {}
    for (let i = 0; i < addresses.length; i++) {
      const r = results[i]
      if (r && r.status === 'success' && typeof r.result === 'number') {
        out[addresses[i]!.toLowerCase()] = r.result
      }
    }
    return out
  } catch {
    return {} // unresolved stays the 18 default at the consumer
  }
}

/** Vault-fallback multicall reads for one pool's metrics state. */
export async function fetchPoolState(
  client: DiscoveryClient,
  vault: `0x${string}`,
  poolId: `0x${string}`,
  decimalsByAddress: Record<string, number>
): Promise<PoolState> {
  const pool = poolId.toLowerCase() as `0x${string}`

  // 1. getPoolTokenInfo via VAULT fallback (extension views execute through
  //    the vault's delegatecall fallback — direct-to-extension reverts).
  const info = (await client.readContract({
    address: vault,
    abi: [
      {
        inputs: [{ name: 'pool', type: 'address' }],
        name: 'getPoolTokenInfo',
        outputs: [
          { name: 'tokens', type: 'address[]' },
          {
            name: 'tokenInfo',
            type: 'tuple[]',
            components: [
              { name: 'tokenType', type: 'uint8' },
              { name: 'rateProvider', type: 'address' },
              { name: 'paysYieldFees', type: 'bool' },
            ],
          },
          { name: 'balancesRaw', type: 'uint256[]' },
          { name: 'lastBalancesLiveScaled18', type: 'uint256[]' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getPoolTokenInfo',
    args: [pool],
  })) as unknown as { tokens: string[]; balancesRaw: bigint[] } | [string[], unknown[], bigint[], bigint[]]

  // viem returns MULTIPLE outputs positionally (array) for this ABI —
  // normalize both shapes (named + positional).
  const tokensOut: string[] = Array.isArray(info) ? info[0] : info.tokens
  const balancesOut: bigint[] = Array.isArray(info) ? info[2] : info.balancesRaw

  const tokens: MetricToken[] = tokensOut.map(address => ({
    address,
    decimals: decimalsByAddress[address.toLowerCase()] ?? 18,
  }))

  // 2. weights: POOL-direct read (vault fallback reverts — live-probed).
  let weights: number[] | null

  try {
    const raw = (await client.readContract({
      address: pool,
      abi: [
        {
          inputs: [],
          name: 'getNormalizedWeights',
          outputs: [{ name: '', type: 'uint256[]' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getNormalizedWeights',
    })) as unknown as bigint[]

    weights = raw.map(w => Number(w) / 1e18)
  } catch {
    weights = null // reCLAMM etc — derivation unavailable
  }

  // 3. static swap fee via vault fallback.
  let staticSwapFee: number | null

  try {
    const fee = (await client.readContract({
      address: vault,
      abi: [
        {
          inputs: [{ name: 'pool', type: 'address' }],
          name: 'getStaticSwapFeePercentage',
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getStaticSwapFeePercentage',
      args: [pool],
    })) as unknown as bigint

    staticSwapFee = Number(fee) / 1e18
  } catch {
    staticSwapFee = null
  }

  return { poolId: pool, tokens, balancesRaw: balancesOut, weights, staticSwapFee }
}

/**
 * Fetch USD prices for token addresses via GeckoTerminal multi-price.
 * Keyless, CORS-open (live-verified). Unknown chains → empty map.
 * GT does not serve Base Sepolia — BASESEP honestly returns {}.
 */
export async function fetchTokenPrices(
  chain: GqlChain,
  addresses: string[]
): Promise<Record<string, number>> {
  const network = GT_NETWORK[chain]
  if (!network || addresses.length === 0) return {}
  // lowercase canonical form — checksummed addresses can miss on GT.
  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/multi/${addresses.map(a => a.toLowerCase()).join(',')}`

  try {
    const res = await fetch(url)
    if (!res.ok) return {}

    const json = (await res.json()) as {
      data?: { attributes: { address: string; price_usd?: string } }[]
    }

    const prices: Record<string, number> = {}

    for (const token of json.data || []) {
      const usd = Number(token.attributes?.price_usd)

      if (Number.isFinite(usd) && usd > 0) {
        prices[token.attributes.address.toLowerCase()] = usd
      }
    }

    return prices
  } catch {
    return {}
  }
}

/**
 * Scan Vault Swap events since `fromBlock` (exclusive) in provider-range
 * chunks (B3, live-probed 2026-10-21): publicnode archive-walls any range
 * older than its recent window ("Archive requests require a personal
 * token") — even 5k-block ranges ~11h back. The Tenderly public gateway
 * (CORS-open, browser-verified) serves 1000-block archive ranges. A
 * walled chunk falls back per-chunk; non-archive errors never hit the
 * fallback; both fail → the chunk is skipped honestly (never throws).
 */
const ARCHIVE_WALL_MARKERS = ['archive requests require', 'personal token', 'block range too large']

function isArchiveWallError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err ?? '').toLowerCase()
  return ARCHIVE_WALL_MARKERS.some(m => msg.includes(m))
}

/** Tenderly public gateway — the visitor-reachable archive fallback (CORS-open). */
export const ARCHIVE_FALLBACK_RPC: Partial<Record<number, string>> = {
  8453: 'https://base.gateway.tenderly.co',
}

/** Result of a window scan — buckets + the oldest contiguously covered block. */
export interface ScanSwapBucketsResult {
  buckets: SwapBucket[]
  /** Oldest block contiguously covered by successful chunks (B3). */
  coveredFrom: number
}

/** Scan Vault Swap events since `fromBlock` (exclusive) in provider-range chunks. */
export async function scanSwapBuckets(
  client: Pick<DiscoveryClient, 'request'>,
  vault: string,
  fromBlock: number,
  latestBlock: number,
  chunkSize: number,
  fallbackClient?: Pick<DiscoveryClient, 'request'>,
  fallbackChunkSize = 1_000
): Promise<ScanSwapBucketsResult> {
  const logs: { blockNumber: string; topics: string[]; data: string }[] = []
  let contiguousStart: number | null = null

  for (let from = fromBlock + 1; from <= latestBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, latestBlock)

    const chunkLogs = await scanChunk(
      client,
      fallbackClient,
      vault,
      from,
      to,
      fallbackChunkSize
    )

    if (chunkLogs === null) {
      // hole — contiguity restarts at the next successful chunk
      contiguousStart = null
      continue
    }

    logs.push(...chunkLogs)
    if (contiguousStart === null) contiguousStart = from
  }

  const coveredFrom =
    contiguousStart !== null
      ? contiguousStart
      : fromBlock >= latestBlock
        ? fromBlock
        : latestBlock + 1

  // block → epoch ms via Base 2s block time, anchored at latestBlock/now.
  const now = Date.now()
  const blockToMs = (block: number) => now - (latestBlock - block) * 2_000
  return { buckets: decodeSwapLogsToBuckets(logs, blockToMs), coveredFrom }
}

/** Scan one chunk; null = hole (chunk not covered). */
async function scanChunk(
  client: Pick<DiscoveryClient, 'request'>,
  fallbackClient: Pick<DiscoveryClient, 'request'> | undefined,
  vault: string,
  from: number,
  to: number,
  fallbackChunkSize: number
): Promise<{ blockNumber: string; topics: string[]; data: string }[] | null> {
  type Logs = { blockNumber: string; topics: string[]; data: string }[]

  const getRange = (c: Pick<DiscoveryClient, 'request'>, f: number, t: number) =>
    c.request({
      method: 'eth_getLogs',
      params: [
        {
          address: vault as `0x${string}`,
          topics: [SWAP_TOPIC0],
          fromBlock: ('0x' + BigInt(f).toString(16)) as `0x${string}`,
          toBlock: ('0x' + BigInt(t).toString(16)) as `0x${string}`,
        },
      ],
    }) as Promise<Logs>

  try {
    return await getRange(client, from, to)
  } catch (err) {
    if (!isArchiveWallError(err) || !fallbackClient) return null
  }

  // archive-walled — subdivide on the fallback at the gateway limit;
  // ANY failed sub-chunk marks the whole chunk a hole (conservative).
  const subLogs: Logs = []
  const subSize = Math.max(1, fallbackChunkSize)

  for (let f = from; f <= to; f += subSize) {
    const t = Math.min(f + subSize - 1, to)
    try {
      subLogs.push(...(await getRange(fallbackClient, f, t)))
    } catch {
      return null
    }
  }

  return subLogs
}
