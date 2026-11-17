import { describe, expect, it } from 'vitest'
import {
  getSeedTokenPrices,
  priceTierFor,
  SEED_PRICE_MAX_AGE_SECONDS,
  type SeedPricesBlock,
} from './seed-token-prices'

/**
 * The third price tier (Boss cache doctrine 2026-11-17).
 *
 * Live GeckoTerminal walls under burst; IRIS already holds a per-token price
 * refreshed every 900s, baked into the registry. The seed tier fills gaps so
 * pool TVL stops rendering '—' whenever the wall outlives the session cache.
 *
 * The load-bearing law is the 1-HOUR AGE CAP, enforced twice: at export time
 * by the Python exporter, and again HERE at read time, because a registry that
 * sat on disk only gets older. Rendering a 53-hour-old PIPS price as current
 * TVL is the same lie-class as a fabricated $0.00.
 */

const NOW_MS = 1_800_000_000_000
const NOW_S = NOW_MS / 1000

function block(tokens: SeedPricesBlock['tokens']): SeedPricesBlock {
  return { source: 'iris:nut_token.price_usd', producer: 'price_producer', tokens }
}

function entry(price: number | null, ageSeconds: number | null, source = 'dexscreener-market') {
  return {
    price_usd: price,
    source: price === null ? null : source,
    cached_at: ageSeconds === null ? null : NOW_S - ageSeconds,
  }
}

describe('getSeedTokenPrices — the baked third tier', () => {
  it('returns a seed price inside the age cap', () => {
    const out = getSeedTokenPrices('BASE', ['0xabc'], block({ '0xabc': entry(12.5, 900) }), {
      nowMs: NOW_MS,
    })

    expect(out).toEqual({ '0xabc': '12.5' })
  })

  it('DROPS a seed older than one hour — a stale snapshot is not a price', () => {
    const out = getSeedTokenPrices('BASE', ['0xabc'], block({ '0xabc': entry(53, 190_800) }), {
      nowMs: NOW_MS,
    })

    expect(out).toEqual({})
  })

  it('keeps a seed at exactly the cap boundary', () => {
    const out = getSeedTokenPrices(
      'BASE',
      ['0xabc'],
      block({ '0xabc': entry(5, SEED_PRICE_MAX_AGE_SECONDS) }),
      { nowMs: NOW_MS }
    )

    expect(out).toEqual({ '0xabc': '5' })
  })

  it('drops a seed one second past the cap', () => {
    const out = getSeedTokenPrices(
      'BASE',
      ['0xabc'],
      block({ '0xabc': entry(5, SEED_PRICE_MAX_AGE_SECONDS + 1) }),
      { nowMs: NOW_MS }
    )

    expect(out).toEqual({})
  })

  it('treats a null price as absent, never as zero', () => {
    const out = getSeedTokenPrices('BASE', ['0xabc'], block({ '0xabc': entry(null, 60) }), {
      nowMs: NOW_MS,
    })

    expect(out).toEqual({})
    expect('0xabc' in out).toBe(false)
  })

  it('treats a zero or negative price as absent', () => {
    const zero = getSeedTokenPrices('BASE', ['0xabc'], block({ '0xabc': entry(0, 60) }), {
      nowMs: NOW_MS,
    })

    const negative = getSeedTokenPrices('BASE', ['0xdef'], block({ '0xdef': entry(-3, 60) }), {
      nowMs: NOW_MS,
    })

    expect(zero).toEqual({})
    expect(negative).toEqual({})
  })

  it('treats a null cached_at as absent — a price with no timestamp cannot be aged', () => {
    const out = getSeedTokenPrices('BASE', ['0xabc'], block({ '0xabc': entry(9, null) }), {
      nowMs: NOW_MS,
    })

    expect(out).toEqual({})
  })

  it('ignores an address absent from the block', () => {
    const out = getSeedTokenPrices('BASE', ['0xmissing'], block({}), { nowMs: NOW_MS })
    expect(out).toEqual({})
  })

  it('matches addresses case-insensitively', () => {
    const out = getSeedTokenPrices('BASE', ['0xABC'], block({ '0xabc': entry(3, 60) }), {
      nowMs: NOW_MS,
    })

    expect(out).toEqual({ '0xabc': '3' })
  })

  it('serves BASE only — no other chain borrows the Base bake', () => {
    const seeded = block({ '0xabc': entry(3, 60) })

    expect(getSeedTokenPrices('BASE', ['0xabc'], seeded, { nowMs: NOW_MS })).not.toEqual({})
    expect(getSeedTokenPrices('MAINNET', ['0xabc'], seeded, { nowMs: NOW_MS })).toEqual({})
  })

  it('tolerates a missing block entirely (registry predates the tier)', () => {
    expect(getSeedTokenPrices('BASE', ['0xabc'], undefined)).toEqual({})
  })

  it('honours a maxAgeSeconds override', () => {
    const seeded = block({ '0xabc': entry(3, 120) })

    expect(
      getSeedTokenPrices('BASE', ['0xabc'], seeded, { nowMs: NOW_MS, maxAgeSeconds: 60 })
    ).toEqual({})

    expect(
      getSeedTokenPrices('BASE', ['0xabc'], seeded, { nowMs: NOW_MS, maxAgeSeconds: 300 })
    ).toEqual({ '0xabc': '3' })
  })
})

describe('priceTierFor — explicit provenance', () => {
  it('live wins over seed', () => {
    expect(priceTierFor('0xabc', { '0xabc': '10' }, { '0xabc': '99' })).toBe('live')
  })

  it('seed answers when live is absent', () => {
    expect(priceTierFor('0xabc', {}, { '0xabc': '99' })).toBe('seed')
  })

  it('seed answers when live is zero — a zero is not a price', () => {
    expect(priceTierFor('0xabc', { '0xabc': '0' }, { '0xabc': '99' })).toBe('seed')
  })

  it('none when neither tier resolves', () => {
    expect(priceTierFor('0xabc', {}, {})).toBe('none')
  })
})
