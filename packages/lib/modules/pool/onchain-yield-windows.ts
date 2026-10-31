/**
 * Multi-window yield metrics for onchain-only pools (P1, 2026-10-31).
 *
 * The swap-ledger buckets (full history since deploy, hourly) are the single
 * fee/volume source. This module derives 24h / 7d / Lifetime windows with
 * annualized APR, daily-compounded APY, and NET yield (post protocol cut).
 *
 * Laws:
 * - Coverage NEVER derives from bucket presence: quiet hours legitimately
 *   have no bucket (zero volume is real, not missing). Window coverage comes
 *   from the ledger ENVELOPE — scan range start + freshness — mirroring
 *   hasLedgerFullCoverage. A fresh full-history ledger with zero in-window
 *   buckets is COVERED with honest zero fees; a stale ledger never claims a
 *   window (APR null, fees still shown understated-but-real).
 * - Unpriced in-window token -> fees/volume null (never fabricate USD).
 * - APR annualizes fees over the window (365/windowDays); lifetime uses the
 *   pool's actual age. TVL 0 or age unknown -> APR null (never divide by
 *   zero, never annualize over an unknown period).
 * - APY compounds the APR daily: (1 + apr/365)^365 - 1.
 * - NET = APR x (1 - protocolCutBps/10_000); cut 0 (today's truth) -> NET
 *   equals APR. The field is future-proofed for when a fee cut is enabled.
 */

import type { SwapBucket } from './onchain-metrics'

export type YieldBucket = SwapBucket

const HOUR = 3_600_000
const DAY_MS = 86_400_000

/** Ledger freshness bound — a scan older than this never claims a window. */
const COVERAGE_FRESHNESS_MS = 2 * HOUR

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
 * swap ledger. Coverage comes from the ledger envelope (startMs + savedAtMs);
 * omit it and no window is ever claimed (fees still aggregate honestly).
 */
export function computeYieldWindows({
  buckets,
  pool,
  prices,
  decimals,
  tvl,
  now,
  coverage,
  poolAgeDays,
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
  /** Ledger envelope: continuous scan start + last save. */
  coverage?: { startMs: number; savedAtMs: number }
  /** Pool age in days (createTime -> now). 0/unknown -> lifetime APR null. */
  poolAgeDays?: number
  /** Protocol aggregate-fee cut in bps (0 today). */
  protocolCutBps?: number
}): YieldWindowsResult {
  const nowHour = Math.floor(now / HOUR)

  // envelope laws: fresh scan + range covering the window
  const fresh = coverage !== undefined && now - coverage.savedAtMs <= COVERAGE_FRESHNESS_MS

  const covers = (days: number) =>
    fresh && coverage !== undefined && coverage.startMs <= now - days * DAY_MS + HOUR

  const w24h = windowMetrics({
    buckets,
    pool,
    prices,
    decimals,
    fromHour: nowHour - 23,
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
    fromHour: nowHour - 7 * 24 + 1,
    tvl,
    windowDays: 7,
    protocolCutBps,
    covered: covers(7),
  })

  const lifetimeAge = poolAgeDays ?? 0

  const lifetime = windowMetrics({
    buckets,
    pool,
    prices,
    decimals,
    fromHour: null,
    tvl,
    windowDays: lifetimeAge > 0 ? lifetimeAge : null,
    protocolCutBps,
    covered: covers(lifetimeAge > 0 ? lifetimeAge : 1),
  })

  return { w24h, w7d, lifetime }
}
