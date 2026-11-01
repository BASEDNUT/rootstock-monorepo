import { describe, expect, it } from 'vitest'
import { sortOnchainPools, totalApr } from './pool-metrics'

/**
 * Onchain-only list controls (browser-verified defect 2026-10-24): sort
 * and minTvl state only fed the SKIPPED API query — onchain-sourced pools
 * rendered in registry order regardless of the clicked column sort, and
 * the minTvl filter never applied. sortOnchainPools applies the active
 * sorting state (TVL / Volume24h / APR, asc|desc, nulls LAST in both
 * directions) and the minTvl floor client-side. Empty sorting state =
 * the honest default: TVL descending.
 */

interface TestPool {
  id: string
  dynamicData: {
    totalLiquidity: string | null
    volume24h: string | null
    aprItems: { apr: number }[]
  }
}

const pool = (id: string, tvl: string | null, vol: string | null, apr: number[]): TestPool => ({
  id,
  dynamicData: {
    totalLiquidity: tvl,
    volume24h: vol,
    aprItems: apr.map(a => ({ apr: a })),
  },
})

describe('totalApr', () => {
  it('sums aprItems', () => {
    expect(totalApr([{ apr: 0.5 }, { apr: 1.5 }])).toBe(2)
  })

  it('null for empty or missing aprItems', () => {
    expect(totalApr([])).toBe(null)
    expect(totalApr(undefined)).toBe(null)
  })
})

describe('sortOnchainPools', () => {
  it('empty sorting state defaults to TVL descending (nulls last)', () => {
    const pools = [
      pool('a', '16.8', null, []),
      pool('b', '1500', null, []),
      pool('c', null, null, []),
      pool('d', '7.06', null, []),
    ]

    const out = sortOnchainPools(pools, [])
    expect(out.map(p => p.id)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('sorts TVL ascending on request (nulls still last)', () => {
    const pools = [
      pool('a', '16.8', null, []),
      pool('b', '1500', null, []),
      pool('c', null, null, []),
      pool('d', '7.06', null, []),
    ]

    const out = sortOnchainPools(pools, [{ id: 'totalLiquidity', desc: false }])
    expect(out.map(p => p.id)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('sorts volume24h descending', () => {
    const pools = [pool('a', '10', '5', []), pool('b', '10', '500', []), pool('c', '10', null, [])]
    const out = sortOnchainPools(pools, [{ id: 'volume24h', desc: true }])
    expect(out.map(p => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts APR descending by summed aprItems (empty apr = last)', () => {
    const pools = [
      pool('a', '10', null, []),
      pool('b', '10', null, [0.4]),
      pool('c', '10', null, [1.2, 0.3]),
    ]

    const out = sortOnchainPools(pools, [{ id: 'apr', desc: true }])
    expect(out.map(p => p.id)).toEqual(['c', 'b', 'a'])
  })

  it('minTvl floor drops pools below it and null-TVL pools when set', () => {
    const pools = [
      pool('a', '16.8', null, []),
      pool('b', '1500', null, []),
      pool('c', null, null, []),
      pool('d', '7.06', null, []),
    ]

    const out = sortOnchainPools(pools, [], 10)
    expect(out.map(p => p.id)).toEqual(['b', 'a'])
  })

  it('minTvl zero keeps every pool (nulls included)', () => {
    const pools = [pool('a', '16.8', null, []), pool('c', null, null, [])]
    const out = sortOnchainPools(pools, [], 0)
    expect(out.map(p => p.id)).toEqual(['a', 'c'])
  })

  it('does not mutate the input array', () => {
    const pools = [pool('a', '1', null, []), pool('b', '2', null, [])]
    const snapshot = [...pools]
    sortOnchainPools(pools, [])
    expect(pools).toEqual(snapshot)
  })
})

/**
 * S133 (boss-caught 2026-10-31): the APR column renders the SELECTED
 * window's APR (yieldWindows[window].apr) but the sort read the fixed
 * aprItems value — clicking APR on the 24h tab reordered nothing visible.
 * The sort must rank by the SAME number the row shows.
 */
describe('sortOnchainPools — window-aware APR (S133)', () => {
  const windows = (
    w24h: number | null,
    w7d: number | null,
    life: number | null,
    w30d: number | null = null
  ) => ({
    w24h: { apr: w24h },
    w7d: { apr: w7d },
    w30d: { apr: w30d },
    lifetime: { apr: life },
  })

  const wp = (
    id: string,
    aprItems: number[],
    w: ReturnType<typeof windows>
  ): TestPool & { yieldWindows: ReturnType<typeof windows> } => ({
    ...pool(id, '10', null, aprItems),
    yieldWindows: w,
  })

  it('sorts by the 24h window APR when the 24h window is selected', () => {
    const pools = [
      wp('a', [0.5], windows(0.01, 0.5, 2)),
      wp('b', [0.5], windows(0.9, 0.1, 0.2)),
      wp('c', [0.5], windows(0.3, 0.3, 0.3)),
    ]

    const out = sortOnchainPools(pools, [{ id: 'apr', desc: true }], 0, '24h')
    expect(out.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by the lifetime window APR when lifetime is selected', () => {
    const pools = [
      wp('a', [0.5], windows(0.01, 0.5, 2)),
      wp('b', [0.5], windows(0.9, 0.1, 0.2)),
      wp('c', [0.5], windows(0.3, 0.3, 0.3)),
    ]

    const out = sortOnchainPools(pools, [{ id: 'apr', desc: true }], 0, 'lifetime')
    expect(out.map(p => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('falls back to aprItems when a pool carries no yieldWindows', () => {
    const pools = [pool('a', '10', null, [0.1]), pool('b', '10', null, [0.9])]

    const out = sortOnchainPools(pools, [{ id: 'apr', desc: true }], 0, '24h')
    expect(out.map(p => p.id)).toEqual(['b', 'a'])
  })

  it('null window APR sorts last (never treated as zero)', () => {
    const pools = [wp('a', [5], windows(null, 0.5, 0.5)), wp('b', [0.5], windows(0.01, 0.5, 0.5))]

    const out = sortOnchainPools(pools, [{ id: 'apr', desc: true }], 0, '24h')
    expect(out.map(p => p.id)).toEqual(['b', 'a'])
  })
})

/**
 * S134 (2026-11-01): the Volume column renders the SELECTED window's
 * volume — the sort must rank by the same number (same law as the APR
 * fix in S133). Falls back to dynamicData.volume24h when a pool carries
 * no yieldWindows; null window volume sorts last (never zero).
 */
describe('sortOnchainPools — window-aware volume (S134)', () => {
  type VolWindows = {
    w24h: { apr: number | null; volumeUsd: number | null }
    w7d: { apr: number | null; volumeUsd: number | null }
    w30d: { apr: number | null; volumeUsd: number | null }
    lifetime: { apr: number | null; volumeUsd: number | null }
  }

  const volWindows = (
    w24h: number | null,
    w7d: number | null,
    life: number | null,
    w30d: number | null = null
  ): VolWindows => ({
    w24h: { apr: null, volumeUsd: w24h },
    w7d: { apr: null, volumeUsd: w7d },
    w30d: { apr: null, volumeUsd: w30d },
    lifetime: { apr: null, volumeUsd: life },
  })

  const vp = (
    id: string,
    volume24h: string | null,
    w: VolWindows
  ): TestPool & { yieldWindows: VolWindows } => ({
    ...pool(id, '10', volume24h, []),
    yieldWindows: w,
  })

  it('sorts by the 24h window volume when the 24h window is selected', () => {
    const pools = [
      vp('a', '500', volWindows(5, 500, 2000)),
      vp('b', '5', volWindows(900, 10, 20)),
      vp('c', '50', volWindows(300, 300, 300)),
    ]

    const out = sortOnchainPools(pools, [{ id: 'volume24h', desc: true }], 0, '7d', '24h')
    expect(out.map(p => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by the 7d window volume when the 7d window is selected (default)', () => {
    const pools = [vp('a', '500', volWindows(5, 500, 2000)), vp('b', '5', volWindows(900, 10, 20))]

    const out = sortOnchainPools(pools, [{ id: 'volume24h', desc: true }], 0, '7d', '7d')
    expect(out.map(p => p.id)).toEqual(['a', 'b'])
  })

  it('sorts by the 30d window volume when the 30d window is selected', () => {
    const pools = [
      vp('a', '500', volWindows(5, 500, 2000, 100)),
      vp('b', '5', volWindows(900, 10, 20, 9000)),
    ]

    const out = sortOnchainPools(pools, [{ id: 'volume24h', desc: true }], 0, '7d', '30d')
    expect(out.map(p => p.id)).toEqual(['b', 'a'])
  })

  it('falls back to dynamicData.volume24h when a pool carries no yieldWindows', () => {
    const pools = [pool('a', '10', '5', []), pool('b', '10', '500', [])]

    const out = sortOnchainPools(pools, [{ id: 'volume24h', desc: true }], 0, '7d', '24h')
    expect(out.map(p => p.id)).toEqual(['b', 'a'])
  })

  it('null window volume sorts last (never treated as zero)', () => {
    const pools = [
      vp('a', '999', volWindows(null, 500, 500)),
      vp('b', '0.01', volWindows(1, 500, 500)),
    ]

    const out = sortOnchainPools(pools, [{ id: 'volume24h', desc: true }], 0, '7d', '24h')
    expect(out.map(p => p.id)).toEqual(['b', 'a'])
  })
})
