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
import { createDiscoveryClientFor, type DiscoveryClient } from './onchain-pool-fetch'

/** Create a metrics reader for a chain (null when no scan config). */
export function createMetricsClient(chain: GqlChain): DiscoveryClient | null {
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig) return null
  return createDiscoveryClientFor(scanConfig)
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
          { name: 'tokenInfo', type: 'tuple[]' },
          { name: 'balancesRaw', type: 'uint256[]' },
          { name: 'lastBalancesLiveScaled18', type: 'uint256[]' },
        ],
        stateMutability: 'view',
        type: 'function',
      },
    ],
    functionName: 'getPoolTokenInfo',
    args: [pool],
  })) as unknown as { tokens: string[]; balancesRaw: bigint[] }

  const tokens: MetricToken[] = info.tokens.map(address => ({
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

  return { poolId: pool, tokens, balancesRaw: info.balancesRaw, weights, staticSwapFee }
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
  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/multi/${addresses.join(',')}`

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

/** Scan Vault Swap events since `fromBlock` (exclusive) in provider-range chunks. */
export async function scanSwapBuckets(
  client: DiscoveryClient,
  vault: string,
  fromBlock: number,
  latestBlock: number,
  chunkSize: number
): Promise<SwapBucket[]> {
  const logs: { blockNumber: string; topics: string[]; data: string }[] = []

  for (let from = fromBlock + 1; from <= latestBlock; from += chunkSize) {
    const to = Math.min(from + chunkSize - 1, latestBlock)

    const batch = (await client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: vault as `0x${string}`,
          topics: [SWAP_TOPIC0],
          fromBlock: ('0x' + BigInt(from).toString(16)) as `0x${string}`,
          toBlock: ('0x' + BigInt(to).toString(16)) as `0x${string}`,
        },
      ],
    })) as { blockNumber: string; topics: string[]; data: string }[]

    logs.push(...batch)
  }

  // block → epoch ms via Base 2s block time, anchored at latestBlock/now.
  const now = Date.now()
  const blockToMs = (block: number) => now - (latestBlock - block) * 2_000
  return decodeSwapLogsToBuckets(logs, blockToMs)
}
