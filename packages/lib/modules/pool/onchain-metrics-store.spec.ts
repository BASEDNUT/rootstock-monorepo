import { beforeEach, describe, expect, it } from 'vitest'
import {
  hasLedgerFullCoverage,
  computeCoverageStartBlock,
  loadSwapLedger,
  SWAP_LEDGER_STORE_VERSION,
  type SwapLedgerStore,
} from './onchain-metrics-store'

/*
 * B3 (live-caught 2026-10-21): the old gate granted full 24h coverage from
 * baked coverageStartMs ALONE — coverage-start says when history BEGINS,
 * not that the trailing window is gap-free. The baked cursor froze days
 * earlier and the visitor scan only reaches ~latest-10k blocks (publicnode
 * archive wall, live-probed), so swaps in the gap silently rendered as
 * genuine $0.00 while coverage was claimed. Honest gate: coverage is
 * continuous only from the persisted coverageStartBlock (a bridging scan
 * extends it backward to the baked coverage start), with a fresh savedAt
 * and a cursor at the chain tip.
 */

const HOUR = 3_600_000
const now = 1_800_000_000_000
const latest = 52_921_609
const BLOCK_MS = 2_000
const CUTOFF_BLOCK = latest - (24 * HOUR) / BLOCK_MS // 43,200 back
const W = 10_000 // publicnode scan window cap (live-probed)

const bakedFresh = { cursor: latest - 10, coverageStartMs: now - 40 * 24 * HOUR }
const bakedStale = { cursor: latest - 90_000, coverageStartMs: now - 40 * 24 * HOUR }

const store = (over: Partial<SwapLedgerStore>): SwapLedgerStore => ({
  version: 2,
  chainId: 8453,
  cursor: latest,
  savedAt: now,
  coverageStartBlock: latest - W,
  buckets: [],
  ...over,
})

describe('hasLedgerFullCoverage — continuous-coverage honest gate (B3)', () => {
  it('fresh bake bridged by the scan + fresh store at tip → covered', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: latest - 50_000 }),
        bakedFresh,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(true)
  })

  it('stale bake (cursor beyond the scan wall) → gap NOT covered even with old coverageStart', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: latest - W }),
        bakedStale,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(false)
  })

  it('no bake, visitor coverage born before the cutoff → covered', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: CUTOFF_BLOCK - 100 }),
        null,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(true)
  })

  it('visitor coverage born mid-window (after cutoff) → NOT covered', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: latest - 100 }),
        null,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(false)
  })

  it('stale savedAt (scan failing) → NOT covered', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: CUTOFF_BLOCK - 100, savedAt: now - 2 * HOUR }),
        bakedFresh,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(false)
  })

  it('cursor lagging the tip (tail unscanned) → NOT covered', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: CUTOFF_BLOCK - 100, cursor: latest - 5_000 }),
        bakedFresh,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(false)
  })

  it('no store → NOT covered (baked alone never claims the window)', () => {
    expect(hasLedgerFullCoverage(null, bakedFresh, latest, now, BLOCK_MS)).toBe(false)
  })

  it('missing coverageStartBlock (legacy store) → NOT covered', () => {
    expect(
      hasLedgerFullCoverage(
        store({ coverageStartBlock: undefined as unknown as number }),
        null,
        latest,
        now,
        BLOCK_MS
      )
    ).toBe(false)
  })
})

describe('computeCoverageStartBlock — bridging math (B3)', () => {
  it('scan bridging a fresh bake extends the start to the baked coverage start', () => {
    const bakedStartBlock = latest - 200_000

    const start = computeCoverageStartBlock({
      previous: undefined,
      fromBlock: latest - W,
      bridgesBaked: true,
      bakedCoverageStartBlock: bakedStartBlock,
    })

    expect(start).toBe(bakedStartBlock)
  })

  it('unbridged scan with a previous-cursor gap restarts coverage at fromBlock', () => {
    const start = computeCoverageStartBlock({
      previous: { startBlock: latest - 50_000, cursor: latest - 60_000 },
      fromBlock: latest - W,
      bridgesBaked: false,
      bakedCoverageStartBlock: latest - 200_000,
    })

    expect(start).toBe(latest - W)
  })

  it('continuation scan (fromBlock at previous cursor + 1) keeps the previous start', () => {
    const start = computeCoverageStartBlock({
      previous: { startBlock: latest - 60_000, cursor: latest - 2_100 },
      fromBlock: latest - 2_099,
      bridgesBaked: false,
      bakedCoverageStartBlock: undefined,
    })

    expect(start).toBe(latest - 60_000)
  })

  it('scan 100 blocks past the previous cursor is a GAP → restart at fromBlock', () => {
    const start = computeCoverageStartBlock({
      previous: { startBlock: latest - 60_000, cursor: latest - 2_100 },
      fromBlock: latest - 2_000,
      bridgesBaked: false,
      bakedCoverageStartBlock: undefined,
    })

    expect(start).toBe(latest - 2_000)
  })

  it('scan reaching further back than the previous start extends coverage (min semantics)', () => {
    const start = computeCoverageStartBlock({
      previous: { startBlock: latest - 60_000, cursor: latest - 2_100 },
      fromBlock: latest - 80_000,
      bridgesBaked: false,
      bakedCoverageStartBlock: undefined,
    })

    expect(start).toBe(latest - 80_000)
  })
})

describe('store v4 — cadence-poisoned bucket purge (S134e)', () => {
  beforeEach(() => localStorage.clear())

  it('voids a v3 store (hours derived from dead 2s math) on load', () => {
    localStorage.setItem(
      'rootstock.swap-ledger.8453',
      JSON.stringify({
        version: 3,
        chainId: 8453,
        cursor: 54_000_000,
        savedAt: Date.now(),
        coverageStartBlock: 53_900_000,
        buckets: [
          {
            hour: 496_000,
            pool: '0x' + 'a'.repeat(40),
            token: '0x' + 'b'.repeat(40),
            amountInRaw: '1',
            feeAmountRaw: '1',
          },
        ],
      })
    )

    expect(loadSwapLedger(8453)).toBeNull()
    expect(localStorage.getItem('rootstock.swap-ledger.8453')).toBeNull()
  })

  it('loads a v4 store carrying the real coverageStartMs', () => {
    localStorage.setItem(
      'rootstock.swap-ledger.8453',
      JSON.stringify({
        version: SWAP_LEDGER_STORE_VERSION,
        chainId: 8453,
        cursor: 54_000_000,
        savedAt: Date.now(),
        coverageStartBlock: 52_131_550,
        coverageStartMs: 1_759_000_000_000,
        buckets: [],
      })
    )

    const s = loadSwapLedger(8453)
    expect(s).not.toBeNull()
    expect(s!.coverageStartMs).toBe(1_759_000_000_000)
  })

  it('voids a store whose version is unknown', () => {
    localStorage.setItem(
      'rootstock.swap-ledger.8453',
      JSON.stringify({
        version: 99,
        chainId: 8453,
        cursor: 1,
        savedAt: 1,
        coverageStartBlock: 1,
        buckets: [],
      })
    )

    expect(loadSwapLedger(8453)).toBeNull()
  })
})
