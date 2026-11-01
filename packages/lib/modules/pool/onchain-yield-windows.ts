/**
 * Multi-window yield metrics for onchain-only pools (P1, 2026-10-31;
 * S133 anchor rework 2026-10-31).
 *
 * The swap-ledger buckets (full history since deploy, hourly) are the single
 * fee/volume source. This module derives 24h / 7d / Lifetime windows with
 * annualized APR, daily-compounded APY, and NET yield (post protocol cut).
 *
 * Laws:
 * - Coverage NEVER derives from bucket presence: quiet hours legitimately
 *   have no bucket (zero volume is real, not missing). Window coverage comes
 *   from the ledger ENVELOPE — scan range start + data end. A full-history
 *   ledger with zero in-window buckets is COVERED with honest zero fees.
 * - S133 ANCHOR LAW: windows are measured against the ledger DATA END
 *   (savedAtMs), not wall-clock now. A bake-only or scan-failed session
 *   still shows real, windowed APRs from the data it has; buckets after the
 *   anchor are excluded (never counted into a window they postdate).
 * - S133 GRACE: a ledger older than 48h never claims a window (too stale to
 *   present as current). Within the grace, 24h/7d windows are honest — the
 *   column names the window and the anchor is the data end. The 2h gate
 *   before S133 zeroed every APR once a bake aged — with real volume on
 *   screen (live-caught 2026-10-31).
 * - Unpriced in-window token -> fees/volume null (never fabricate USD).
 * - APR annualizes fees over the window (365/windowDays); lifetime uses
 *   the pool's actual age from createTime (unix ms) measured at the
 *   anchor. TVL 0 or age unknown -> APR null (never divide by zero).
 * - APY compounds the APR daily: (1 + apr/365)^365 - 1.
 * - NET = APR x (1 - protocolCutBps/10_000); cut 0 (today's truth) -> NET
 *   equals APR. The field is future-proofed for when a fee cut is enabled.
 */

import type { SwapBucket } from './onchain-metrics'

export type YieldBucket = SwapBucket

const HOUR = 3_600_000
const DAY_MS = 86_400_000

/**
 * S133 ledger grace — data older than this never claims a window. The
 * pre-S133 2h freshness gate zeroed every APR hours after each bake on a
 * static deployment; 48h keeps numbers real while bounding staleness.
 */
const COVERAGE_GRACE_MS = 48 * HOUR

export interface YieldWindowMetrics {
  /** Sum of priced in-window swap fees, USD. Null when a token is unpriced. */
  feesUsd: number | null
  /** Sum of priced in-window swap volume, USD. Null when a token is unpriced. */
  volumeUsd: number | null
  /** Annualized fee APR (fraction). Null when uncovered or TVL is 0. */
  apr: number | null
  /** APR compounded daily. Null iff APR is null. */
  apy: number | null
  /** APR net of the protocol cut. Null iff APR is null. */
  netYieldApr: number | null
  /** True when the ledger envelope covers this window (fresh + full). */
  covered: boolean
  /** Wall-clock hours the window actually spans (24, 168, pool age). */
  windowHours: number
}

export interface YieldWindowsResult {
  w24h: YieldWindowMetrics
  w7d: YieldWindowMetrics
  w30d: YieldWindowMetrics
  lifetime: YieldWindowMetrics
}

/** Daily-compounded APY from an annual APR fraction. Passes negative rates. */
export function aprToApy(apr: number): number {
  if (apr === 0) return 0
  return Math.pow(1 + apr / 365, 365) - 1
}

function windowMetrics({
  buckets,
  pool,
  prices,
  decimals,
  fromHour,
  toHour,
  tvl,
  windowDays,
  protocolCutBps,
  covered,
}: {
  buckets: YieldBucket[]
  pool: string
  prices: Record<string, number>
  decimals: Record<string, number>
  /** Inclusive lower hour bound (epoch-ms/HOUR); null = full history. */
  fromHour: number | null
  /** Inclusive upper hour bound (the anchor hour). */
  toHour: number
  tvl: number
  /** Period the window annualizes over (365/windowDays). */
  windowDays: number | null
  protocolCutBps: number
  covered: boolean
}): YieldWindowMetrics {
  const poolKey = pool.toLowerCase()
  let fees = 0
  let volume = 0
  let priced = true

  for (const b of buckets) {
    if (b.pool !== poolKey) continue
    if (fromHour !== null && b.hour < fromHour) continue
    if (b.hour > toHour) continue // S133 anchor: never count post-anchor data
    const price = prices[b.token]

    if (price === undefined) {
      priced = false
      continue
    }

    const dec = decimals[b.token] ?? 18
    fees += (Number(BigInt(b.feeAmountRaw)) / 10 ** dec) * price
    volume += (Number(BigInt(b.amountInRaw)) / 10 ** dec) * price
  }

  const feesUsd = priced ? fees : null
  const volumeUsd = priced ? volume : null

  const windowHours = windowDays === null ? 0 : Math.round(windowDays * 24)

  let apr: number | null = null

  if (covered && priced && tvl > 0 && windowDays !== null && windowDays > 0) {
    apr = (fees * 365) / windowDays / tvl
  }

  const apy = apr === null ? null : aprToApy(apr)
  const netYieldApr = apr === null ? null : apr * (1 - protocolCutBps / 10_000)

  return { feesUsd, volumeUsd, apr, apy, netYieldApr, covered, windowHours }
}

/**
 * Compute 24h / 7d / Lifetime yield windows for one pool from the merged
 * swap ledger.
 *
 * S133: windows anchor at the ledger DATA END (min(now, savedAtMs)) — a
 * bake-only or scan-failed session computes real numbers from its data;
 * buckets newer than the anchor are excluded. Coverage comes from the
 * envelope (startMs + savedAtMs within the 48h grace); omit it and no
 * window is ever claimed (fees still aggregate honestly).
 */
export function computeYieldWindows({
  buckets,
  pool,
  prices,
  decimals,
  tvl,
  now,
  coverage,
  poolCreateTimeMs,
  protocolCutBps = 0,
}: {
  buckets: YieldBucket[]
  pool: string
  prices: Record<string, number>
  decimals: Record<string, number>
  /** Current pool TVL, USD. */
  tvl: number
  /** Current time (epoch ms). */
  now: number
  /** Ledger envelope: continuous scan start + last save (data end). */
  coverage?: { startMs: number; savedAtMs: number }
  /** Pool creation time (unix ms). 0/unknown -> lifetime APR null. */
  poolCreateTimeMs?: number
  /** Protocol aggregate-fee cut in bps (0 today). */
  protocolCutBps?: number
}): YieldWindowsResult {
  // S133 anchor: the data end, never the wall clock.
  const anchor = coverage !== undefined ? Math.min(now, coverage.savedAtMs) : now
  const anchorHour = Math.floor(anchor / HOUR)

  // envelope laws: data within the grace + range covering the window
  const fresh = coverage !== undefined && now - coverage.savedAtMs <= COVERAGE_GRACE_MS

  const covers = (days: number) =>
    fresh && coverage !== undefined && coverage.startMs <= anchor - days * DAY_MS + HOUR

  const w24h = windowMetrics({
    buckets,
    pool,
    prices,
    decimals,
    fromHour: anchorHour - 23,
    toHour: anchorHour,
    tvl,
    windowDays: 1,
    protocolCutBps,
    covered: covers(1),
  })

  const w7d = windowMetrics({
    buckets,
    pool,
    prices,
    decimals,
    fromHour: anchorHour - 7 * 24 + 1,
    toHour: anchorHour,
    tvl,
    windowDays: 7,
    protocolCutBps,
    covered: covers(7),
  })

  // S134 (2026-11-01): 30d joins the selector — same anchor + coverage
  // laws as 24h/7d. Pools born 2026-10-03 only truly span 30d from
  // 2026-11-02; before that the envelope honestly does NOT cover the
  // window (APR dashes) while the observed fee/volume sums stay real.
  const w30d = windowMetrics({
    buckets,
    pool,
    prices,
    decimals,
    fromHour: anchorHour - 30 * 24 + 1,
    toHour: anchorHour,
    tvl,
    windowDays: 30,
    protocolCutBps,
    covered: covers(30),
  })

  // S133: lifetime age is measured from the pool's REAL creation time
  // (unix ms) to the anchor; the ledger must span the pool's whole life
  // (startMs <= birth) to claim the window. The pre-S133 poolAgeDays input
  // was fed a BLOCK NUMBER as seconds (age ~55y) — lifetime was always
  // '—' despite real history (live-caught 2026-10-31).
  const birthMs = poolCreateTimeMs ?? 0
  const lifetimeAgeDays = birthMs > 0 ? Math.max(0, (anchor - birthMs) / DAY_MS) : 0

  const lifetime = windowMetrics({
    buckets,
    pool,
    prices,
    decimals,
    fromHour: null,
    toHour: anchorHour,
    tvl,
    windowDays: lifetimeAgeDays > 0 ? lifetimeAgeDays : null,
    protocolCutBps,
    covered: fresh && coverage !== undefined && birthMs > 0 && coverage.startMs <= birthMs,
  })

  return { w24h, w7d, w30d, lifetime }
}
