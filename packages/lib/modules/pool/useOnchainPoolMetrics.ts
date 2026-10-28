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
  fetchMissingTokenDecimals,
  resolveTokenDecimals,
  scanSwapBuckets,
  ARCHIVE_FALLBACK_RPC,
  type PoolState,
} from './onchain-metrics-io'
import { getOnchainScanConfig, type OnchainPoolListItem } from './onchain-pool-discovery'
import { computePoolMetrics, type SwapBucket } from './onchain-metrics'
import {
  loadSwapLedger,
  mergeBuckets,
  saveSwapLedger,
  hasLedgerFullCoverage,
  computeCoverageStartBlock,
} from './onchain-metrics-store'
import bakedLedgerBase from './baked-swap-ledger-base.json'
import bakedLedgerSepolia from './baked-swap-ledger.json'

const CHUNKS: Partial<Record<number, number>> = {
  // B3 (live-probed 2026-10-21): publicnode archive-walls ranges beyond its
  // recent window AND 9.9k-wide ranges — 5k-wide at the head serves. Older
  // chunks fall back to the Tenderly gateway (1000-block archive ranges).
  8453: 5_000,
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

  // 0. B1 (live-caught 2026-10-21): resolve token decimals from the POOLS
  // THEMSELVES (baked-registry poolTokens carry ERC20 metadata), then the
  // caller catalog, then an onchain erc20 multicall. The catalog alone
  // starved SNUT(9)/cbBTC(8)/tBTC(8)/EURC(6)/USDC(6)/NVDAc(8)/AAPLc(8)
  // legs to $0.00 — every unknown decimal defaulted to 18 and halved
  // pNUT TVL ($82 shown vs $161 on-chain truth).
  const { decimals, missing } = resolveTokenDecimals(pools, decimalsByAddress)
  const onchainDecimals = await fetchMissingTokenDecimals(client, missing)
  const resolvedDecimals: Record<string, number> = { ...decimals, ...onchainDecimals }

  // 1. pool states (vault-fallback reads, throttled 3-wide to respect RPC limits)
  const states: PoolState[] = []

  for (let i = 0; i < pools.length; i += 3) {
    const batch = await Promise.all(
      pools
        .slice(i, i + 3)
        .map(p => fetchPoolState(client, vault, p.address as `0x${string}`, resolvedDecimals))
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

  // B3: scan the whole trailing 24h window every time (cutoff-aware), NOT
  // just latest-10k — the visitor scan is the only thing that can cover the
  // window; the archive fallback bridges publicnode's wall per chunk.
  const BLOCK_MS = 2_000
  const cutoffBlock = Math.floor(latest - (24 * 3_600_000) / BLOCK_MS)
  // continue from the farthest known cursor (visitor ledger or fresh bake);
  // a fresh bake covers [deploy, bakedCursor] itself, so the visitor only
  // scans [bakedCursor, latest] — until the bake ages past the window, then
  // the cutoff floors the scan. An aged bake (cursor < cutoff) does NOT
  // shrink the scan (max keeps the cutoff).
  const fromBlock = Math.max(ledger?.cursor ?? 0, Number(baked?.cursor ?? 0), cutoffBlock)
  const chunk = CHUNKS[scanConfig.chainId] ?? 500
  let buckets = mergeBuckets((baked?.buckets as SwapBucket[]) ?? [], ledger?.buckets ?? [])

  // Tenderly public gateway fallback for archive-walled chunks (B3).
  const fallbackRpc = ARCHIVE_FALLBACK_RPC[scanConfig.chainId]

  const fallbackClient = fallbackRpc
    ? ({
        request: (args: { method: string; params: unknown[] }) =>
          fetch(fallbackRpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, ...args }),
          }).then(r =>
            r.json().then(j => {
              if (j.error) throw new Error(String(j.error.message ?? j.error))
              return j.result
            })
          ),
      } as Pick<Parameters<typeof scanSwapBuckets>[0], 'request'>)
    : undefined

  try {
    const fresh = await scanSwapBuckets(
      client,
      scanConfig.vault,
      fromBlock,
      latest,
      chunk,
      fallbackClient
    )

    // display: all observed logs (pre-hole included — understated-but-real)
    buckets = mergeBuckets(buckets, fresh.buckets)

    // D3 (2026-10-27): coverage is a PREFIX-RUN property. The scan's
    // contiguous run starts at fromBlock + 1 and ends at the FIRST hole
    // (coveredTo); the ledger cursor only advances to coveredTo, so the
    // next scan re-attempts the hole (self-heal within the sliding 24h
    // window). Nothing covered (coveredTo < coveredFrom sentinel) → the
    // previous ledger survives untouched; this render stays display-grade.
    // v3 ledger buckets are PREFIX-RUN visitor buckets ONLY (baked merged
    // at display, never persisted) — sum-merge stays double-count-free
    // because every persisted range starts after the previous cursor.
    const nothingCovered = fresh.coveredTo < fresh.coveredFrom

    if (!nothingCovered) {
      const bridgesBaked = fromBlock <= (baked?.cursor ?? 0) + 1

      // baked coverage start (block) = block-time inverse of coverageStartMs
      const bakedCoverageStartBlock =
        baked?.coverageStartMs !== undefined
          ? Math.max(
              0,
              latest - Math.floor((Date.now() - Number(baked.coverageStartMs)) / BLOCK_MS)
            )
          : undefined

      const coverageStartBlock = computeCoverageStartBlock({
        previous:
          ledger && fromBlock <= ledger.cursor + 1
            ? { startBlock: ledger.coverageStartBlock, cursor: ledger.cursor }
            : undefined,
        fromBlock,
        bridgesBaked,
        bakedCoverageStartBlock,
      })

      // v3 ledger: PREFIX-RUN visitor buckets only (ledger + fresh prefix).
      // Post-hole observed logs are display-grade (understated-but-real) but
      // NEVER persisted — the next scan re-attempts the hole from the
      // cursor, and re-scanning their range cannot double-count.
      const visitorBuckets = mergeBuckets(ledger?.buckets ?? [], fresh.contiguousBuckets)

      saveSwapLedger({
        version: 3,
        chainId: scanConfig.chainId,
        cursor: Math.max(ledger?.cursor ?? 0, fresh.coveredTo),
        savedAt: Date.now(),
        coverageStartBlock,
        buckets: visitorBuckets,
      })
    }
  } catch {
    // scan failure keeps the baked+stored ledger — metrics degrade honestly
  }

  const now = Date.now()

  // B3: the saved store (v2) carries coverageStartBlock; reloaded fresh here
  // because the in-flight save above may have been the first v2 write.
  const fullCoverage = hasLedgerFullCoverage(
    loadSwapLedger(scanConfig.chainId),
    baked
      ? { cursor: Number(baked.cursor ?? 0), coverageStartMs: Number(baked.coverageStartMs ?? 0) }
      : null,
    latest,
    now,
    BLOCK_MS
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
