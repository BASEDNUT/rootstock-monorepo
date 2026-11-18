import { describe, expect, it } from 'vitest'
import { computeYieldWindows, VOLUME_MAX_AGE_MS } from './onchain-yield-windows'
import type { SwapBucket } from './onchain-metrics'

/*
 * Volume freshness gate — Boss fresh-data doctrine 2026-11-17.
 *
 * S133 law (unchanged, opt-in OFF): a stale-anchored ledger still reports its
 * real observed sums, because "understated but real" beats a fabricated zero.
 * The doctrine adds the missing third case: when the caller KNOWS the ledger
 * is too old to be presented as current, an empty window is not "$0.00 of
 * volume happened" — it is "we did not measure it" → em-dash (null).
 *
 * So the gate is explicit: pass maxVolumeAgeMs and volume/fees become null
 * once the anchor is older than that ceiling. Never a confident $0.00.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = 1_700_000_000_000

const PRICES = { '0xtoken': 2 }
const DECIMALS = { '0xtoken': 18 }

const swapNear = (anchorMs: number): SwapBucket => ({
  hour: Math.floor(anchorMs / HOUR) - 1,
  pool: '0xpool',
  token: '0xtoken',
  amountInRaw: String(5e18),
  feeAmountRaw: String(1e18),
})

describe('volume freshness gate — stale data renders em-dash, never $0.00', () => {
  it('ceiling constant is a 48h hard ceiling (Boss daily floor)', () => {
    expect(VOLUME_MAX_AGE_MS).toBe(48 * HOUR)
  })

  it('RED-1: stale ledger + no in-window bucket -> volume NULL, not 0', () => {
    // past the ceiling, no bucket inside the anchored window: the pre-gate
    // behavior initializes volume=0 and prints $0.00 as if measured.
    const r = computeYieldWindows({
      buckets: [],
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now: NOW,
      coverage: { startMs: NOW - 45 * DAY, savedAtMs: NOW - 11 * DAY },
      maxVolumeAgeMs: VOLUME_MAX_AGE_MS,
    })

    expect(r.w24h.volumeUsd).toBeNull()
    expect(r.w24h.feesUsd).toBeNull()
  })

  it('stale ledger WITH a real in-window sum -> still NULL (not current)', () => {
    const savedAtMs = NOW - 11 * DAY

    const r = computeYieldWindows({
      buckets: [swapNear(savedAtMs)],
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now: NOW,
      coverage: { startMs: NOW - 45 * DAY, savedAtMs },
      maxVolumeAgeMs: VOLUME_MAX_AGE_MS,
    })

    expect(r.w24h.volumeUsd).toBeNull()
  })

  it('fresh ledger inside the ceiling -> volume is the real sum', () => {
    const savedAtMs = NOW - 2 * HOUR

    const r = computeYieldWindows({
      buckets: [swapNear(savedAtMs)],
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now: NOW,
      coverage: { startMs: NOW - 45 * DAY, savedAtMs },
      maxVolumeAgeMs: VOLUME_MAX_AGE_MS,
    })

    expect(r.w24h.volumeUsd).toBeCloseTo(10, 6) // 5 tokens x $2
  })

  it('gate OFF (no ceiling passed) keeps the S133 understated-real law', () => {
    const savedAtMs = NOW - 11 * DAY

    const r = computeYieldWindows({
      buckets: [swapNear(savedAtMs)],
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now: NOW,
      coverage: { startMs: NOW - 45 * DAY, savedAtMs },
    })

    expect(r.w24h.volumeUsd).toBeCloseTo(10, 6)
  })

  it('gate is per-window: 7d and 30d go null with the same stale ledger', () => {
    const savedAtMs = NOW - 11 * DAY

    const r = computeYieldWindows({
      buckets: [],
      pool: '0xpool',
      prices: PRICES,
      decimals: DECIMALS,
      tvl: 100,
      now: NOW,
      coverage: { startMs: NOW - 45 * DAY, savedAtMs },
      maxVolumeAgeMs: VOLUME_MAX_AGE_MS,
    })

    expect(r.w7d.volumeUsd).toBeNull()
    expect(r.w30d.volumeUsd).toBeNull()
  })
})
