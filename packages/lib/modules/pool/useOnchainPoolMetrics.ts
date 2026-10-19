'use client'

/**
 * Rootstock onchain dynamic metrics hook.
 *
 * One query per chain: pool states (vault fallback) + GT prices + swap-ledger
 * scan + computePoolMetrics per pool. Enriches OnchainPoolListItem
 * dynamicData with real TVL/volume/fees/APR — honest nulls preserved.
 *
 * Ledger law: scan starts from the stored cursor (never deploy block);
 * publicnode serves ~10k-block recent windows on Base mainnet (chunk 9_900).
 */

import { useQuery } from '@tanstack/react-query'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  createMetricsClient,
  fetchPoolState,
  fetchTokenPrices,
  scanSwapBuckets,
  type PoolState,
} from './onchain-metrics-io'
import { getOnchainScanConfig, type OnchainPoolListItem } from './onchain-pool-discovery'
import { computePoolMetrics, type SwapBucket } from './onchain-metrics'
import {
  loadSwapLedger,
  mergeBuckets,
  saveSwapLedger,
  hasLedgerFullCoverage,
} from './onchain-metrics-store'
import bakedLedgerBase from './baked-swap-ledger-base.json'
import bakedLedgerSepolia from './baked-swap-ledger.json'

const CHUNKS: Partial<Record<number, number>> = {
  8453: 9_900, // publicnode recent-window limit (live-probed)
  84532: 200, // sepolia.base.org getLogs limit is a 200 range (live-probed)
}

export interface OnchainMetricsResult {
  pools: OnchainPoolListItem[]
}

async function fetchChainMetrics(
  chain: GqlChain,
  pools: OnchainPoolListItem[],
  decimalsByAddress: Record<string, number>
): Promise<OnchainPoolListItem[]> {
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig || pools.length === 0) return pools
  // Chains without a price source (GT carries no testnets) get no
  // metrics — USD metrics without prices would fabricate nulls into
  // RPC scans. BASESEP honestly stays '—' (prices are mainnet-only).
  if (chain !== GqlChainValues.Base) return pools

  const client = createMetricsClient(chain)
  if (!client) return pools
  const vault = scanConfig.vault as `0x${string}`

  // 1. pool states (vault-fallback reads, throttled 3-wide to respect RPC limits)
  const states: PoolState[] = []

  for (let i = 0; i < pools.length; i += 3) {
    const batch = await Promise.all(
      pools.slice(i, i + 3).map(p =>
        fetchPoolState(client, vault, p.address as `0x${string}`, decimalsByAddress)
      )
    )

    states.push(...batch)
  }

  // 2. GT prices for every pool token
  const allTokens = [...new Set(states.flatMap(s => s.tokens.map(t => t.address)))]
  const prices = await fetchTokenPrices(chain, allTokens)

  // 3. swap ledger: baked base (build-time archive scan) + visitor
  // localStorage + fresh scan since max(baked cursor, stored cursor).
  const baked = scanConfig.chainId === 8453 ? bakedLedgerBase : bakedLedgerSepolia
  const ledger = loadSwapLedger(scanConfig.chainId)
  const latest = Number(await client.getBlockNumber())

  const scanFrom = Math.max(
    (ledger?.cursor ?? 0),
    Math.min((baked?.cursor ?? 0), latest - 10_000)
  )

  const fromBlock = Math.max(scanFrom, latest - 10_000)
  const chunk = CHUNKS[scanConfig.chainId] ?? 500
  let buckets = mergeBuckets((baked?.buckets as SwapBucket[]) ?? [], ledger?.buckets ?? [])

  try {
    const fresh = await scanSwapBuckets(client, scanConfig.vault, fromBlock, latest, chunk)
    buckets = mergeBuckets(buckets, fresh)

    saveSwapLedger({
      version: 1,
      chainId: scanConfig.chainId,
      cursor: latest,
      savedAt: Date.now(),
      buckets,
    })
  } catch {
    // scan failure keeps the baked+stored ledger — metrics degrade honestly
  }

  const now = Date.now()

  const fullCoverage = hasLedgerFullCoverage(
    ledger,
    (baked?.coverageStartMs as number) ?? null,
    now
  )

  // 4. compute per-pool metrics + enrich
  return pools.map(pool => {
    const state = states.find(s => s.poolId === pool.address.toLowerCase())
    if (!state) return pool

    const metrics = computePoolMetrics({
      poolId: state.poolId,
      tokens: state.tokens,
      balancesRaw: state.balancesRaw,
      weights: state.weights,
      prices,
      buckets,
      hasFullCoverage: fullCoverage,
      now,
    })

    return {
      ...pool,
      dynamicData: {
        ...pool.dynamicData,
        totalLiquidity: metrics.totalLiquidity,
        volume24h: metrics.volume24h,
        fees24h: metrics.fees24h,
        aprItems: metrics.aprItems,
      },
    }
  })
}

/**
 * Enrich onchain-sourced pools with live metrics (TVL, volume, fees, APR).
 * Returns the same list shape with dynamicData filled; unavailable metrics
 * stay null (render '—').
 */
export function useOnchainPoolMetrics(
  enabled: boolean,
  chains: GqlChain[],
  pools: OnchainPoolListItem[],
  decimalsByAddress: Record<string, number> = {}
) {
  const chainKey = chains.join(',')
  return useQuery<OnchainMetricsResult>({
    queryKey: ['onchain-pool-metrics', chainKey, pools.map(p => p.address).join(',')],
    queryFn: async () => {
      const byChain = new Map<GqlChain, OnchainPoolListItem[]>()

      for (const pool of pools) {
        const list = byChain.get(pool.chain) ?? []
        list.push(pool)
        byChain.set(pool.chain, list)
      }

      const results = await Promise.all(
        [...byChain.entries()].map(([chain, chainPools]) =>
          fetchChainMetrics(chain, chainPools, decimalsByAddress)
        )
      )

      return { pools: results.flat() }
    },
    enabled: enabled && pools.length > 0,
    staleTime: 60_000,
  })
}
