/**
 * P0 price resilience — GT multi fetch with bounded retry + last-good cache.
 *
 * Live-probed 2026-11-04 (S134d):
 *  - GT serves a 24-address multi call fine (200, 23/24 priced).
 *  - The 5th rapid call returns 429 and the service recovers after ~40s.
 *  - The visitor hook refetches every 30s, walking straight into that wall.
 *  - The old implementation returned {} on ANY non-200, blanking the whole
 *    chain price map — including majors GT prices correctly (WETH). That is
 *    the "no price for WETH" symptom.
 *
 * Laws kept: never fabricate. A cached price is a REAL observation with a
 * timestamp, served only inside the TTL, never beyond it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { fetchTokenPrices, resetTokenPriceCacheForTests } from './onchain-price-source'

const CHAIN = GqlChainValues.Base
const A = '0x' + 'a'.repeat(40)
const B = '0x' + 'b'.repeat(40)

function ok(rows: { address: string; price_usd?: string | null }[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: rows.map(r => ({ attributes: r })) }),
  } as unknown as Response
}

function fail(status: number) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}

function mockFetch(seq: Response[]) {
  const fn = vi.fn()
  for (const r of seq) fn.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fn)
  return fn
}

const NO_DELAY = { retryDelaysMs: [0, 0] }

beforeEach(() => resetTokenPriceCacheForTests())
afterEach(() => vi.unstubAllGlobals())

describe('fetchTokenPrices — success path', () => {
  it('parses price_usd rows into a lowercase address map', async () => {
    mockFetch([
      ok([
        { address: A, price_usd: '2425.47' },
        { address: B, price_usd: '0.000006284' },
      ]),
    ])

    const prices = await fetchTokenPrices(CHAIN, [A, B], NO_DELAY)
    expect(prices[A]).toBeCloseTo(2425.47, 2)
    expect(prices[B]).toBeCloseTo(0.000006284, 12)
  })

  it('drops rows with null or zero price_usd instead of inventing one', async () => {
    mockFetch([
      ok([
        { address: A, price_usd: null },
        { address: B, price_usd: '0' },
      ]),
    ])

    const prices = await fetchTokenPrices(CHAIN, [A, B], NO_DELAY)
    expect(prices[A]).toBeUndefined()
    expect(prices[B]).toBeUndefined()
  })

  it('returns {} for a chain with no GT network', async () => {
    const fn = vi.fn()
    vi.stubGlobal('fetch', fn)
    const prices = await fetchTokenPrices(GqlChainValues.BaseSepolia, [A], NO_DELAY)
    expect(prices).toEqual({})
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('fetchTokenPrices — retry policy', () => {
  it('retries after a 429 and returns the recovered prices', async () => {
    const fn = mockFetch([fail(429), ok([{ address: A, price_usd: '10' }])])
    const prices = await fetchTokenPrices(CHAIN, [A], NO_DELAY)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(prices[A]).toBeCloseTo(10, 6)
  })

  it('retries a 5xx', async () => {
    const fn = mockFetch([fail(503), ok([{ address: A, price_usd: '7' }])])
    const prices = await fetchTokenPrices(CHAIN, [A], NO_DELAY)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(prices[A]).toBeCloseTo(7, 6)
  })

  it('does not retry a 404 (permanent, not a rate wall)', async () => {
    const fn = mockFetch([fail(404)])
    const prices = await fetchTokenPrices(CHAIN, [A], NO_DELAY)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(prices).toEqual({})
  })

  it('gives up after the retry budget and returns {} with no cache', async () => {
    const fn = mockFetch([fail(429), fail(429), fail(429)])
    const prices = await fetchTokenPrices(CHAIN, [A], NO_DELAY)
    expect(fn).toHaveBeenCalledTimes(3)
    expect(prices).toEqual({})
  })
})

describe('fetchTokenPrices — last-good cache', () => {
  it('serves a still-fresh observation when GT keeps 429ing', async () => {
    mockFetch([ok([{ address: A, price_usd: '100' }])])
    await fetchTokenPrices(CHAIN, [A], { now: 1_000 })

    vi.unstubAllGlobals()
    mockFetch([fail(429), fail(429), fail(429)])

    const prices = await fetchTokenPrices(CHAIN, [A], {
      now: 1_000 + 60_000,
      retryDelaysMs: [0, 0],
    })

    expect(prices[A]).toBeCloseTo(100, 6)
  })

  it('never serves an observation older than the TTL', async () => {
    mockFetch([ok([{ address: A, price_usd: '100' }])])
    await fetchTokenPrices(CHAIN, [A], { now: 1_000 })

    vi.unstubAllGlobals()
    mockFetch([fail(429), fail(429), fail(429)])

    const prices = await fetchTokenPrices(CHAIN, [A], {
      now: 1_000 + 6 * 60_000,
      retryDelaysMs: [0, 0],
    })

    expect(prices).toEqual({})
  })

  it('keeps a cached price for a token a later 200 drops', async () => {
    mockFetch([
      ok([
        { address: A, price_usd: '50' },
        { address: B, price_usd: '9' },
      ]),
    ])

    await fetchTokenPrices(CHAIN, [A, B], { now: 1_000 })

    vi.unstubAllGlobals()
    mockFetch([ok([{ address: B, price_usd: '11' }])])

    const prices = await fetchTokenPrices(CHAIN, [A, B], {
      now: 1_000 + 10_000,
      retryDelaysMs: [0, 0],
    })

    expect(prices[A]).toBeCloseTo(50, 6)
    expect(prices[B]).toBeCloseTo(11, 6) // fresh beats cached
  })
})
