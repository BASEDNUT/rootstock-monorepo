/**
 * useOnchainYieldWindows — multi-window yield metrics hook (P1).
 *
 * Same source law as the chart series: merged swap ledger (baked histogram +
 * visitor localStorage store) priced with GT prices. The metrics hook's scan
 * keeps the visitor store fresh; coverage combines the baked file's
 * coverageStartMs (deploy) with the visitor scan's anchored range + freshness.
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
import { computeYieldWindows, type YieldWindowsResult } from './onchain-yield-windows'
import bakedLedgerBase from './baked-swap-ledger-base.json'
import bakedLedgerSepolia from './baked-swap-ledger.json'

interface BakedLedgerFile {
  cursor: number
  coverageStartMs: number
  buckets?: SwapBucket[]
}

function bakedFor(chainId: number): BakedLedgerFile | null {
  if (chainId === 8453) return bakedLedgerBase as unknown as BakedLedgerFile
  if (chainId === 84532) return bakedLedgerSepolia as unknown as BakedLedgerFile
  return null
}

export type { YieldWindowsResult }

export function useOnchainYieldWindows(
  enabled: boolean,
  chain: GqlChain | undefined,
  poolId: string | undefined,
  tvl: number,
  poolCreateTime: number,
  decimalsByAddress: Record<string, number>
) {
  const { priceFor } = useTokens()

  const query = useQuery({
    queryKey: ['onchain-yield-windows', chain, poolId, Math.round(tvl)],
    queryFn: (): YieldWindowsResult => {
      const scanConfig = chain ? getOnchainScanConfig(chain) : undefined

      if (!scanConfig || !poolId) {
        return computeYieldWindows({
          buckets: [],
          pool: '0x0',
          prices: {},
          decimals: {},
          tvl: 0,
          now: Date.now(),
        })
      }

      const baked = bakedFor(scanConfig.chainId)
      const ledger = loadSwapLedger(scanConfig.chainId)
      const buckets = [...((baked?.buckets ?? []) as SwapBucket[]), ...(ledger?.buckets ?? [])]

      const prices: Record<string, number> = {}

      for (const b of buckets) {
        if (b.pool !== poolId.toLowerCase()) continue
        const p = priceFor(b.token, chain!)
        if (p > 0) prices[b.token] = p
      }

      const now = Date.now()

      const poolAgeDays =
        poolCreateTime > 0 ? Math.max(0, (now - poolCreateTime * 1000) / 86_400_000) : 0

      // Coverage law: baked file anchors the history start (deploy); the
      // visitor scan anchors its own range end (savedAt fresh). Combined
      // coverage = min(starts) with visitor freshness. Baked cursor aging
      // past the visitor scan window leaves a gap the compute module gates
      // honestly (7d/lifetime APR null until the next bake or bridging scan).
      let coverage: { startMs: number; savedAtMs: number } | undefined

      if (ledger && baked) {
        const visitorStartMs = ledger.savedAt - (ledger.cursor - ledger.coverageStartBlock) * 2_000

        coverage = {
          startMs: Math.min(Number(baked.coverageStartMs ?? Infinity), visitorStartMs),
          savedAtMs: ledger.savedAt,
        }
      }

      return computeYieldWindows({
        buckets,
        pool: poolId,
        prices,
        decimals: decimalsByAddress,
        tvl,
        now,
        coverage,
        poolAgeDays,
      })
    },
    enabled: enabled && !!chain && !!poolId && !!isOnchainOnlyNetwork(chain!),
    staleTime: 60_000,
  })

  return useMemo(() => query, [query])
}
