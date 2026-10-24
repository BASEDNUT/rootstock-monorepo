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
