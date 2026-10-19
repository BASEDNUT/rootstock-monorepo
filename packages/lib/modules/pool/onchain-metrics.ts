/**
 * Rootstock onchain dynamic metrics — pure computation layer.
 *
 * Companion to onchain-pool-fetch.ts (list/discovery). This module owns
 * the DISPLAY METRICS math: TVL, fees24h, volume24h, APR items.
 *
 * Laws (auditor round-2 FIX-3 lineage):
 * - Never fabricate. Unavailable = null → renders as '—'.
 * - A genuine 0 (no swaps in a COVERED 24h window) is a real value.
 * - Without full ledger coverage, a zero aggregation is UNKNOWN (null);
 *   observed events are reported understated-but-real; APR needs coverage.
 *
 * Fee source truth (source-verified, frozen V3 Vault.sol
 * _computeAndChargeAggregateSwapFees): _aggregateFeeAmounts stores ONLY
 * the aggregate share (protocol+creator) — with aggregate % = 0 the
 * counters stay 0 forever. Fees/volume therefore come from Vault Swap
 * EVENTS, which carry the FULL swapFeeAmount + amountIn (charged in
 * tokenIn).
 *
 * Ledger: hourly buckets per (pool, tokenIn); baked histogram at build
 * time (full history via archive RPC) + visitor localStorage extension
 * (recent-window scans). hasFullCoverage gates honest zeros + APR.
 */

import type { GqlPoolAprItem } from '@repo/lib/shared/services/api/graphql-derived-types'

const HOUR_MS = 3_600_000

/** One hour of aggregated swap activity for a (pool, tokenIn). */
export interface SwapBucket {
  /** Hour index (epoch ms / 3_600_000). */
  hour: number
  /** Lowercase pool address. */
  pool: string
  /** Lowercase tokenIn address (both amount + fee are in tokenIn units). */
  token: string
  amountInRaw: string
  feeAmountRaw: string
}

/** Raw eth_getLogs Swap entry (untyped RPC shape). */
export interface RawSwapLog {
  blockNumber: string
  topics: string[]
  data: string
}

export interface MetricToken {
  address: string
  decimals: number
}

/**
 * Decode raw Swap logs into hourly buckets. Malformed entries are
 * skipped — never throw on garbage. `blockToMs` maps a block number to
 * its epoch-ms timestamp (caller-supplied: cache or approximation).
 */
export function decodeSwapLogsToBuckets(
  logs: RawSwapLog[],
  blockToMs: (blockNumber: number) => number
): SwapBucket[] {
  const map = new Map<string, SwapBucket>()

  for (const log of logs) {
    if (!log?.topics || log.topics.length < 4) continue
    const data = (log.data || '').slice(2)
    if (data.length < 4 * 64) continue
    const pool = topicToAddress(log.topics[1] ?? '')
    const token = topicToAddress(log.topics[2] ?? '') // tokenIn
    const amountInRaw = BigInt('0x' + data.slice(0, 64))
    const feeAmountRaw = BigInt('0x' + data.slice(3 * 64, 4 * 64))
    const ts = blockToMs(parseInt(log.blockNumber, 16))
    if (!Number.isFinite(ts)) continue
    const hour = Math.floor(ts / HOUR_MS)
    const key = `${hour}|${pool}|${token}`
    const existing = map.get(key)

    if (existing) {
      existing.amountInRaw = (BigInt(existing.amountInRaw) + amountInRaw).toString()
      existing.feeAmountRaw = (BigInt(existing.feeAmountRaw) + feeAmountRaw).toString()
    } else {
      map.set(key, { hour, pool, token, amountInRaw: amountInRaw.toString(), feeAmountRaw: feeAmountRaw.toString() })
    }
  }

  return [...map.values()]
}

/** topic → address: strip 0x + leading zeros ('0x' + 64 hex chars). */
function topicToAddress(topic: string): string {
  const hex = topic.startsWith('0x') ? topic.slice(2) : topic
  const stripped = hex.replace(/^0+/, '')
  return ('0x' + (stripped === '' ? '0' : stripped)).toLowerCase()
}

/**
 * Sum USD volume + fees over the trailing-24h window for one pool.
 * Returns nulls when ANY in-window bucket token lacks a price — never
 * fabricate USD. `decimals` defaults to 18 per token.
 */
export function aggregateSwapBuckets({
  pool,
  buckets,
  prices,
  decimals,
  now,
}: {
  pool: string
  buckets: SwapBucket[]
  prices: Record<string, number>
  decimals?: Record<string, number>
  now: number
}): { volumeUsd: number | null; feesUsd: number | null } {
  const currentHour = Math.floor(now / HOUR_MS)
  let volumeUsd = 0
  let feesUsd = 0

  for (const b of buckets) {
    if (b.pool !== pool.toLowerCase()) continue
    if (b.hour <= currentHour - 24) continue // trailing 24h window
    const price = prices[b.token]
    if (price === undefined) return { volumeUsd: null, feesUsd: null }
    const dec = decimals?.[b.token] ?? 18
    volumeUsd += (Number(BigInt(b.amountInRaw)) / 10 ** dec) * price
    feesUsd += (Number(BigInt(b.feeAmountRaw)) / 10 ** dec) * price
  }

  return { volumeUsd, feesUsd }
}

/**
 * Derive USD prices for unpriced tokens from one priced anchor using
 * weighted-pool spot relations: USD_i = USD_j * (b_j * w_i) / (b_i * w_j).
 *
 * Only valid for weighted pools (weights non-null). Returns DERIVED
 * prices only — callers merge over the known prices.
 */
export function deriveUnpricedTokenPrices({
  tokens,
  balancesRaw,
  weights,
  prices,
}: {
  tokens: MetricToken[]
  balancesRaw: bigint[]
  weights: number[] | null
  prices: Record<string, number>
}): Record<string, number> {
  const derived: Record<string, number> = {}
  if (!weights || tokens.length !== weights.length) return derived

  const human: (number | null)[] = tokens.map((t, i) => {
    const bal = balancesRaw[i]
    if (bal === undefined || bal === 0n) return null
    return Number(bal) / 10 ** t.decimals
  })

  let anchor = -1

  for (let i = 0; i < tokens.length; i++) {
    const p = prices[tokens[i]!.address.toLowerCase()]

    if (p !== undefined && human[i] !== null && human[i]! > 0 && weights[i]! > 0) {
      anchor = i
      break
    }
  }

  if (anchor === -1) return derived

  for (let i = 0; i < tokens.length; i++) {
    const key = tokens[i]!.address.toLowerCase()
    if (prices[key] !== undefined) continue
    if (human[i] === null || human[i]! <= 0 || weights[i]! <= 0) continue

    derived[key] =
      (prices[tokens[anchor]!.address.toLowerCase()]! * human[anchor]! * weights[i]!) /
      (human[i]! * weights[anchor]!)
  }

  return derived
}

export interface PoolMetricsInput {
  poolId: string
  tokens: MetricToken[]
  /** Raw onchain balances (index-aligned with tokens). */
  balancesRaw: bigint[]
  /** Normalized weights; null when unavailable (reCLAMM reverts). */
  weights: number[] | null
  /** Known USD prices by lowercase token address (GT + derived merge). */
  prices: Record<string, number>
  /** Swap ledger buckets (baked histogram + visitor scans). */
  buckets: SwapBucket[]
  /** True when the 24h window is fully covered by the ledger. */
  hasFullCoverage: boolean
  /** Current time (epoch ms). */
  now: number
}

export interface PoolMetrics {
  /** USD, string (GqlPoolDynamicData convention); null = unavailable. */
  totalLiquidity: string | null
  fees24h: string | null
  volume24h: string | null
  aprItems: GqlPoolAprItem[]
}

/** Compute display metrics for one onchain-sourced pool. */
export function computePoolMetrics(input: PoolMetricsInput): PoolMetrics {
  const { poolId, tokens, balancesRaw, weights, buckets, hasFullCoverage, now } = input

  // ---- prices: known + derived (weighted pools only) ----
  const prices: Record<string, number> = { ...input.prices }

  for (const [k, v] of Object.entries(
    deriveUnpricedTokenPrices({ tokens, balancesRaw, weights, prices: input.prices })
  )) {
    prices[k] = v
  }

  // ---- TVL: sum of priced balances ----
  let tvlKnown = true
  let tvl = 0

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    const price = prices[token.address.toLowerCase()]

    if (price === undefined) {
      tvlKnown = false
      break
    }

    const human = Number(balancesRaw[i] ?? 0n) / 10 ** token.decimals
    tvl += human * price
  }

  const totalLiquidity = tvlKnown ? roundUsd(tvl) : null

  // ---- fees/volume: trailing-24h swap buckets ----
  const decimals: Record<string, number> = {}
  for (const t of tokens) decimals[t.address.toLowerCase()] = t.decimals
  const agg = aggregateSwapBuckets({ pool: poolId, buckets, prices, decimals, now })

  let fees24h: string | null
  let volume24h: string | null
  let aprItems: GqlPoolAprItem[] = []

  if (!hasFullCoverage) {
    // Understated-but-real: report observed events only; zero = unknown.
    volume24h = agg.volumeUsd !== null && agg.volumeUsd > 0 ? roundUsd(agg.volumeUsd) : null
    fees24h = agg.feesUsd !== null && agg.feesUsd > 0 ? roundUsd(agg.feesUsd) : null
  } else {
    volume24h = agg.volumeUsd === null ? null : roundUsd(agg.volumeUsd)
    fees24h = agg.feesUsd === null ? null : roundUsd(agg.feesUsd)

    if (totalLiquidity !== null && fees24h !== null && Number(totalLiquidity) > 0) {
      // APR (percent) = fees24h * 365 / TVL * 100 — GqlPoolAprItem units.
      const apr = (Number(fees24h) * 365 * 100) / Number(totalLiquidity)

      aprItems = [
        {
          __typename: 'GqlPoolAprItem' as const,
          apr,
          id: `${poolId.toLowerCase()}-swap-fee-24h`,
          rewardTokenAddress: null,
          rewardTokenSymbol: null,
          title: 'Swap fee APR',
          type: 'SWAP_FEE_24H' as const,
        },
      ]
    }
  }

  return { totalLiquidity, fees24h, volume24h, aprItems }
}

/** Round USD to display precision (2dp small, integer beyond $1k). */
function roundUsd(v: number): string {
  if (!Number.isFinite(v)) return '0'
  if (Math.abs(v) >= 1000) return String(Math.round(v))
  return String(Math.round(v * 100) / 100)
}
