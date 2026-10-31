/**
 * Onchain chart-series fallback for onchain-only pools (B5, 2026-10-31).
 *
 * The remote snapshots API never knows our pools — VOLUME/FEES charts
 * rendered fabricated flat zeros. This module derives daily series from the
 * SAME swap-ledger buckets the live 24h numbers use (baked histogram +
 * visitor localStorage store; the metrics hook's scan refreshes the store),
 * priced with GT prices — chart and stat numbers can never contradict.
 *
 * Laws (mirrored from computePoolMetrics):
 * - Buckets whose token lacks a price are SKIPPED — understated-but-real,
 *   never fabricated USD.
 * - Days without any priced bucket emit nothing; the provider zero-fills
 *   missing days (existing upstream behavior for sparse ranges).
 * - TVL history is NOT fabricated — only today's point carries the live
 *   totalLiquidity; the provider flat-fills from the first known point.
 */

'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { useTokens } from '@repo/lib/modules/tokens/TokensProvider'
import type { SwapBucket } from './onchain-metrics'
import { loadSwapLedger } from './onchain-metrics-store'
import { getOnchainScanConfig } from './onchain-pool-discovery'
import bakedLedgerBase from './baked-swap-ledger-base.json'
import bakedLedgerSepolia from './baked-swap-ledger.json'

const DAY_MS = 86_400_000

/** Snapshot-shaped day point (the provider consumes these exactly like
 * remote GqlPoolSnapshot entries: timestamp in UTC-midnight SECONDS). */
export interface OnchainSnapshotPoint {
  timestamp: number
  volume24h: string
  fees24h: string
  totalLiquidity: string
  surplus24h: string
}

export interface BuildChartSeriesInput {
  buckets: SwapBucket[]
  pool: string
  prices: Record<string, number>
  decimals: Record<string, number>
  now: number
  /** Live TVL for today's point (string USD or null when unpriced). */
  totalLiquidity: string | null
}

/**
 * Pure builder: buckets -> daily VOLUME/FEES series, newest day last.
 * Understated-but-real law: unpriced tokens are skipped, never zero-priced.
 */
export function buildOnchainChartSeries({
  buckets,
  pool,
  prices,
  decimals,
  now,
  totalLiquidity,
}: BuildChartSeriesInput): OnchainSnapshotPoint[] {
  const poolKey = pool.toLowerCase()
  // day (UTC epoch-ms midnight) -> { volume, fees }
  const byDay = new Map<number, { volume: number; fees: number }>()

  for (const b of buckets) {
    if (b.pool !== poolKey) continue
    const price = prices[b.token]
    if (price === undefined) continue // understated-but-real
    const dec = decimals[b.token] ?? 18
    const dayMs = Math.floor((b.hour * 3_600_000) / DAY_MS) * DAY_MS
    const entry = byDay.get(dayMs) ?? { volume: 0, fees: 0 }
    entry.volume += (Number(BigInt(b.amountInRaw)) / 10 ** dec) * price
    entry.fees += (Number(BigInt(b.feeAmountRaw)) / 10 ** dec) * price
    byDay.set(dayMs, entry)
  }

  const round = (v: number) =>
    Math.abs(v) >= 1000 ? String(Math.round(v)) : String(Math.round(v * 100) / 100)

  const todayMs = Math.floor(now / DAY_MS) * DAY_MS
  const days = [...byDay.keys()].sort((a, b) => a - b)

  return days.map(dayMs => {
    const e = byDay.get(dayMs)!
    return {
      timestamp: dayMs / 1000,
      volume24h: round(e.volume),
      fees24h: round(e.fees),
      // TVL history is unknown — only today's point carries the live value
      totalLiquidity: dayMs === todayMs && totalLiquidity !== null ? totalLiquidity : '0',
      surplus24h: '0',
    }
  })
}

function bakedBucketsFor(chainId: number): SwapBucket[] {
  const baked = chainId === 8453 ? bakedLedgerBase : chainId === 84532 ? bakedLedgerSepolia : null
  return ((baked as { buckets?: SwapBucket[] } | null)?.buckets ?? []) as SwapBucket[]
}

/**
 * Daily VOLUME/FEES chart series for one onchain-only pool, derived from
 * the merged swap ledger (baked + visitor store — no duplicate scan here;
 * the metrics hook's scan keeps the store fresh).
 */
export function useOnchainPoolChartSeries(
  enabled: boolean,
  chain: GqlChain | undefined,
  poolId: string | undefined,
  totalLiquidity: string | null,
  decimalsByAddress: Record<string, number>
) {
  const { priceFor } = useTokens()

  const query = useQuery({
    queryKey: ['onchain-pool-chart-series', chain, poolId, totalLiquidity],
    queryFn: () => {
      // reads happen inside the queryFn so react-query caches by key; the
      // localStorage store may advance between renders and the key's
      // totalLiquidity already changes on metrics refresh.
      const scanConfig = chain ? getOnchainScanConfig(chain) : undefined
      if (!scanConfig || !poolId) return { snapshots: [] as OnchainSnapshotPoint[] }

      const ledger = loadSwapLedger(scanConfig.chainId)
      const buckets = [...bakedBucketsFor(scanConfig.chainId), ...(ledger?.buckets ?? [])]

      const prices: Record<string, number> = {}

      for (const b of buckets) {
        if (b.pool !== poolId.toLowerCase()) continue
        const p = priceFor(b.token, chain!)
        if (p > 0) prices[b.token] = p
      }

      const snapshots = buildOnchainChartSeries({
        buckets,
        pool: poolId,
        prices,
        decimals: decimalsByAddress,
        now: Date.now(),
        totalLiquidity,
      })

      return { snapshots }
    },
    enabled: enabled && !!chain && !!poolId && !!isOnchainOnlyNetwork(chain!),
    staleTime: 60_000,
  })

  // stable memo guard — return [] while loading
  return useMemo(() => query, [query])
}
