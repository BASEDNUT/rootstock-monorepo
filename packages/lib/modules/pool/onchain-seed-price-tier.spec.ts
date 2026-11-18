import { describe, expect, it } from 'vitest'
import { mergeSeedPriceTier } from './onchain-derived-prices'
import { computePoolMetrics, type SwapBucket } from './onchain-metrics'

/*
 * Seed prices in the METRICS price map — Boss cache doctrine 2026-11-17.
 *
 * The seed tier already existed for token DISPLAY (TokensProvider:186-202),
 * but the metrics price map never saw it, so a pool with one unpriced leg
 * rendered '—' TVL even when the baked registry carried a usable seed.
 *
 * Laws:
 * - Live always wins. A seed price is a SNAPSHOT and must never overwrite a
 *   live observation.
 * - Seed fills only ABSENT entries — never 0, never a neighbour's value.
 * - The age cap is enforced upstream by getSeedTokenPrices; this merge is
 *   pure and only orders the tiers.
 */

const NOW = 1_700_000_000_000

const TOKENS = [
  { address: '0xaaa', decimals: 18 },
  { address: '0xbbb', decimals: 18 },
]

const BUCKETLESS: SwapBucket[] = []

describe('mergeSeedPriceTier — third tier enters the metrics map', () => {
  it('fills an absent price from the seed tier', () => {
    const out = mergeSeedPriceTier({ prices: { '0xaaa': 2 }, seedPrices: { '0xbbb': 3 } })

    expect(out['0xaaa']).toBe(2)
    expect(out['0xbbb']).toBe(3)
  })

  it('never overwrites a live price with a seed snapshot', () => {
    const out = mergeSeedPriceTier({ prices: { '0xaaa': 2 }, seedPrices: { '0xaaa': 99 } })

    expect(out['0xaaa']).toBe(2)
  })

  it('ignores a non-finite or non-positive seed value (never fabricate)', () => {
    const out = mergeSeedPriceTier({
      prices: {},
      seedPrices: { '0xaaa': Number.NaN, '0xbbb': 0, '0xccc': -1 },
    })

    expect(out['0xaaa']).toBeUndefined()
    expect(out['0xbbb']).toBeUndefined()
    expect(out['0xccc']).toBeUndefined()
  })

  it('no seed tier -> prices untouched', () => {
    const out = mergeSeedPriceTier({ prices: { '0xaaa': 2 }, seedPrices: undefined })

    expect(out).toEqual({ '0xaaa': 2 })
  })
})

describe('metrics TVL sees the seed tier (end to end)', () => {
  const input = {
    poolId: '0xpool',
    tokens: TOKENS,
    balancesRaw: [10n * 10n ** 18n, 5n * 10n ** 18n] as bigint[],
    prices: { '0xaaa': 2 } as Record<string, number>,
    buckets: BUCKETLESS,
    now: NOW,
    hasFullCoverage: true,
    weights: undefined,
  }

  it('without seed: one unpriced leg -> TVL unknown (em-dash)', () => {
    const m = computePoolMetrics(input as never)
    expect(m.totalLiquidity).toBeNull()
  })

  it('with seed merged: TVL computes, understated-real not zero', () => {
    const m = computePoolMetrics({
      ...input,
      prices: mergeSeedPriceTier({ prices: input.prices, seedPrices: { '0xbbb': 3 } }),
    } as never)

    expect(m.totalLiquidity).not.toBeNull() // 10x2 + 5x3 = 35
    expect(Number(m.totalLiquidity)).toBeCloseTo(35, 6)
  })
})
