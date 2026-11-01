import { describe, expect, it } from 'vitest'
import { computeYieldWindows, aprToApy, type YieldBucket } from './onchain-yield-windows'

/*
 * P1 (2026-10-31): multi-window yield metrics — window aggregation laws,
 * annualization, APY compounding, coverage gates, NET yield.
 *
 * Coverage law: bucket PRESENCE cannot gate a window — hours without swaps
 * legitimately have no bucket (zero volume is real, not missing). Window
 * coverage comes from the ledger ENVELOPE (scan range start + freshness),
 * mirroring hasLedgerFullCoverage. Quiet pools with fresh ledgers are
 * covered with honest zero fees; stale ledgers never claim a window.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

const mk = (hour: number, amountInRaw: string, feeAmountRaw: string): YieldBucket => ({
  hour,
  pool: '0xpool',
  token: '0xtoken',
  amountInRaw,
  feeAmountRaw,
})

const PRICES = { '0xtoken': 2 } // $2/token
const DECIMALS = { '0xtoken': 18 }

function mkBuckets(now: number, pattern: { hoursAgo: number; feeRaw: string }[]): YieldBucket[] {
  const nowHour = Math.floor(now / HOUR)
  return pattern.map(p => mk(nowHour - p.hoursAgo, '0', p.feeRaw))
}

// full-history ledger since 29 days ago, saved now (fresh)
const FULL_COVERAGE = (now: number) => ({ startMs: now - 29 * DAY, savedAtMs: now })

describe('aprToApy — daily compounding', () => {
  it('compounds the annual rate daily', () => {
    // APR 10% -> (1 + 0.10/365)^365 - 1 ~= 10.5156%
    const apy = aprToApy(0.1)
    expect(apy).toBeGreaterThan(0.1051)
    expect(apy).toBeLessThan(0.1052)
  })

  it('APR 0 -> APY 0; small APR stays close to APR', () => {
    expect(aprToApy(0)).toBe(0)
    const small = aprToApy(0.048)
    expect(small).toBeGreaterThan(0.048)
    expect(small).toBeLessThan(0.0492)
  })

  it('negative APR passes through (never fabricate a sign flip)', () => {
    expect(aprToApy(-0.05)).toBeLessThan(0)
  })
})

describe('computeYieldWindows — window laws', () => {
  const now = 1_800_000_000_000

  it('7d window: fees x (365/7) / TVL, coverage-gated', () => {
    // 168 hourly buckets of $0.10 fee = $16.80; TVL $100
    const buckets = mkBuckets(
      now,
      Array.from({ length: 168 }, (_, i) => ({ hoursAgo: i, feeRaw: String(0.05e18) }))
    )

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.w7d.feesUsd).toBeCloseTo(16.8, 6)
    expect(r.w7d.volumeUsd).toBeCloseTo(0, 6) // amountInRaw all zero in fixture
    expect(r.w7d.apr).toBeCloseTo((16.8 * 365) / 7 / 100, 6)
    expect(r.w7d.covered).toBe(true)
    expect(r.w7d.apy).toBeCloseTo(aprToApy((16.8 * 365) / 7 / 100), 6)
  })

  it('7d window with short ledger coverage -> null APR, honest understated fees', () => {
    // ledger only started 3 days ago -> 7d window not covered
    const buckets = mkBuckets(
      now,
      Array.from({ length: 72 }, (_, i) => ({ hoursAgo: i, feeRaw: String(0.05e18) }))
    )

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: { startMs: now - 3 * DAY, savedAtMs: now },
    })

    expect(r.w7d.feesUsd).toBeCloseTo(7.2, 6) // observed only — understated-but-real
    expect(r.w7d.apr).toBeNull()
    expect(r.w7d.covered).toBe(false)
  })

  it('quiet pool: fresh full ledger, zero in-window buckets -> covered, APR 0 (honest zero)', () => {
    // all buckets old (30h ago); ledger fresh + starts 29d ago -> 24h window covered
    const buckets = mkBuckets(now, [{ hoursAgo: 30, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.w24h.feesUsd).toBe(0)
    expect(r.w24h.apr).toBe(0)
    expect(r.w24h.covered).toBe(true)
  })

  it('anchored windows: ledger saved 10h ago still claims (grace 48h), window sums to the data end', () => {
    // S133: windows anchor at the ledger DATA END (savedAt), not wall-clock
    // now — a bake-only or scan-failed session still shows real APRs.
    const buckets = mkBuckets(now, [
      { hoursAgo: 15, feeRaw: String(1e18) }, // inside [anchor-24h, anchor]
      { hoursAgo: 5, feeRaw: String(1e18) }, // AFTER the data end -> excluded
    ])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: { startMs: now - 29 * DAY, savedAtMs: now - 10 * HOUR },
    })

    expect(r.w24h.covered).toBe(true)
    expect(r.w24h.feesUsd).toBe(2) // only the pre-anchor bucket
    expect(r.w24h.apr).toBeCloseTo((2 * 365) / 100, 6)
  })

  it('ledger older than the 48h grace never claims a window', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: { startMs: now - 29 * DAY, savedAtMs: now - 50 * HOUR },
    })

    expect(r.w24h.covered).toBe(false)
    expect(r.w24h.apr).toBeNull()
    expect(r.lifetime.covered).toBe(false)
  })

  it('lifetime window: full ledger sum, annualized over pool age from createTime', () => {
    // S133: poolCreateTimeMs (unix ms) replaces poolAgeDays — the age is
    // measured at the DATA END anchor, never a block number in seconds.
    // 28 days x 24h of $1/hr fee = $672; TVL $100 -> APR = 672 x (365/28) / 100
    const pattern = Array.from({ length: 28 * 24 }, (_, i) => ({
      hoursAgo: i,
      feeRaw: String(0.5e18),
    }))

    const buckets = mkBuckets(now, pattern)

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      poolCreateTimeMs: now - 28 * DAY,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.lifetime.feesUsd).toBe(672) // exact: sum of 672 x $1.0
    expect(r.lifetime.apr).toBeCloseTo((672 * 365) / 28 / 100, 6)
    expect(r.lifetime.covered).toBe(true)
  })

  it('lifetime APR null when pool createTime unknown (0)', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      poolCreateTimeMs: 0,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.lifetime.feesUsd).toBe(2)
    expect(r.lifetime.apr).toBeNull()
  })

  it('unpriced in-window token -> fees/volume null (never fabricate USD)', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: {},
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.w24h.feesUsd).toBeNull()
    expect(r.w24h.volumeUsd).toBeNull()
    expect(r.w24h.apr).toBeNull()
  })

  it('24h window sums trailing 24 buckets incl current hour (boundary exclusive)', () => {
    const buckets = mkBuckets(now, [
      { hoursAgo: 0, feeRaw: String(0.1e18) },
      { hoursAgo: 5, feeRaw: String(0.1e18) },
      { hoursAgo: 24, feeRaw: String(0.1e18) }, // outside
      { hoursAgo: 30, feeRaw: String(0.1e18) }, // outside
      { hoursAgo: 200, feeRaw: String(0.1e18) }, // lifetime only
    ])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.w24h.feesUsd).toBe(0.4) // 2 x $0.20 (0.1 token x $2)
  })

  it('zero TVL -> APR null, fees still reported', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 0,
      now,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.w24h.apr).toBeNull()
    expect(r.w24h.feesUsd).toBe(2)
  })

  it('NET yield = APR x (1 - protocolCut); cut 0 -> NET = APR', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const base = {
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now),
    }

    const cut = computeYieldWindows({ ...base, protocolCutBps: 2500 })
    expect(cut.w24h.netYieldApr).toBeCloseTo(((2 * 365) / 100) * 0.75, 6)

    const noCut = computeYieldWindows(base)
    expect(noCut.w24h.netYieldApr).toBe(noCut.w24h.apr)
  })

  it('buckets of OTHER pools are never counted', () => {
    const mine = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])
    const other = mine.map(b => ({ ...b, pool: '0xother' }))

    const r = computeYieldWindows({
      buckets: [...mine, ...other],
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now),
    })

    expect(r.w24h.feesUsd).toBe(2)
  })

  it('lifetime covered when the ledger spans the whole life (start <= pool createTime)', () => {
    // S133: lifetime coverage = the ledger start precedes the pool birth.
    const buckets = mkBuckets(now, [{ hoursAgo: 5, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      poolCreateTimeMs: now - 28 * DAY,
      coverage: { startMs: now - 28 * DAY, savedAtMs: now },
    })

    expect(r.lifetime.covered).toBe(true)
  })

  it('no coverage metadata -> windows never claimed (null APR, fees observed)', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
    })

    expect(r.w24h.feesUsd).toBe(2)
    expect(r.w24h.apr).toBeNull()
    expect(r.lifetime.feesUsd).toBe(2)
    expect(r.lifetime.apr).toBeNull()
  })
})

/**
 * S134 (2026-11-01): the 30d window joins the selector. Same anchor +
 * coverage laws as 24h/7d — the window spans 30 days back from the
 * ledger DATA END; APR claims only when the envelope covers the full
 * 30d span (fees/volume stay observed-but-understated when it does not).
 */
describe('computeYieldWindows — 30d window (S134)', () => {
  const now = 1_800_000_000_000

  it('w30d sums the trailing 30 days; APR annualized over 30d when covered', () => {
    // 720 hourly buckets of $1 fee = $720; TVL $100 -> APR = 720 x (365/30) / 100
    const buckets = mkBuckets(
      now,
      Array.from({ length: 30 * 24 }, (_, i) => ({ hoursAgo: i, feeRaw: String(0.5e18) }))
    )

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: { startMs: now - 31 * DAY, savedAtMs: now },
    })

    expect(r.w30d.feesUsd).toBeCloseTo(720, 6)
    expect(r.w30d.apr).toBeCloseTo((720 * 365) / 30 / 100, 6)
    expect(r.w30d.covered).toBe(true)
  })

  it('30d boundary: a bucket exactly 30 days old is excluded', () => {
    const buckets = mkBuckets(now, [
      { hoursAgo: 719, feeRaw: String(1e18) },
      { hoursAgo: 720, feeRaw: String(1e18) }, // outside the window
    ])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: { startMs: now - 31 * DAY, savedAtMs: now },
    })

    expect(r.w30d.feesUsd).toBe(2) // only the 719h bucket
  })

  it('ledger starting 29d ago: 30d NOT covered -> APR null, fees still observed', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: FULL_COVERAGE(now), // starts 29d ago
    })

    expect(r.w30d.feesUsd).toBe(2)
    expect(r.w30d.covered).toBe(false)
    expect(r.w30d.apr).toBeNull()
  })

  it('stale ledger (past grace): 30d window never claimed', () => {
    const buckets = mkBuckets(now, [{ hoursAgo: 1, feeRaw: String(1e18) }])

    const r = computeYieldWindows({
      buckets,
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now,
      coverage: { startMs: now - 31 * DAY, savedAtMs: now - 50 * HOUR },
    })

    expect(r.w30d.covered).toBe(false)
    expect(r.w30d.apr).toBeNull()
  })
})
