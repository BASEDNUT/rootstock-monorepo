import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * B2a (live-caught 2026-10-21): onchain-only networks are excluded from
 * GetTokenPrices (supportedNetworks are API networks only), so priceFor()
 * returned 0 for every Rootstock token — pool-detail TVL $0.00, all
 * composition price cells '—', 'From 0 Liquidity Providers', LP token
 * price $0.00. GT multi-price is the onchain-only price source (keyless,
 * CORS-open, live-verified; carries all Rootstock pool tokens).
 */

vi.mock('viem', async importOriginal => {
  const actual = await importOriginal<typeof import('viem')>()
  return { ...actual }
})

import {
  mergeOnchainTokenPrices,
  GT_NETWORK_IDS,
  GT_PRICE_CACHE_TTL_MS,
  resetGtTokenPriceCacheForTests,
} from './onchain-token-prices'

describe('mergeOnchainTokenPrices — GT price layer for onchain-only chains', () => {
  const BASE = 'BASE' as const

  it('GT prices merge into the API price list as GqlTokenPrice-shaped entries', () => {
    const apiPrices = [
      {
        __typename: 'GqlTokenPrice' as const,
        price: 2,
        address: '0xaaa',
        chain: 'MAINNET' as const,
        updatedAt: 1,
      },
    ]

    const gtPrices = { '0xbbb': '1.5', '0xccc': '0.25' }
    const out = mergeOnchainTokenPrices(apiPrices, gtPrices, BASE)
    expect(out).toHaveLength(3)
    const bbb = out.find(p => p.address === '0xbbb')
    expect(bbb?.price).toBe(1.5)
    expect(bbb?.chain).toBe(BASE)
    expect(bbb?.__typename).toBe('GqlTokenPrice')
  })

  it('API prices WIN over GT (API remains the source of truth where it serves)', () => {
    const apiPrices = [
      {
        __typename: 'GqlTokenPrice' as const,
        price: 2,
        address: '0xaaa',
        chain: BASE,
        updatedAt: 1,
      },
    ]

    const gtPrices = { '0xaaa': '9.9' }
    const out = mergeOnchainTokenPrices(apiPrices, gtPrices, BASE)
    const aaa = out.find(p => p.address === '0xaaa')
    expect(aaa?.price).toBe(2)
  })

  it('non-finite / non-positive GT prices are skipped (never fabricate)', () => {
    const gtPrices = { '0xbbb': '0', '0xccc': '-1', '0xddd': 'not-a-number', '0xeee': '1.25' }
    const out = mergeOnchainTokenPrices([], gtPrices, BASE)
    expect(out).toHaveLength(1)
    expect(out[0]?.price).toBe(1.25)
  })

  it('empty inputs → API prices unchanged', () => {
    const apiPrices = [
      {
        __typename: 'GqlTokenPrice' as const,
        price: 2,
        address: '0xaaa',
        chain: BASE,
        updatedAt: 1,
      },
    ]

    const out = mergeOnchainTokenPrices(apiPrices, {}, BASE)
    expect(out).toEqual(apiPrices)
  })

  it('only merges chains the API does not serve (onchainOnlyNetworks)', () => {
    expect(GT_NETWORK_IDS['BASE' as keyof typeof GT_NETWORK_IDS]).toBe('base')
    expect(GT_NETWORK_IDS['BASESEPOLIA' as keyof typeof GT_NETWORK_IDS]).toBeUndefined()
  })
})

describe('fetchGtTokenPrices — GT multi-price fetch (B2a)', () => {
  const BASE = 'BASE' as const
  const USDC = '0x833589fcd5edb6e6fa2cab1b97bad1b63f34e4d1'
  const WETH = '0x4200000000000000000000000000000000000006'

  // The last-good cache is module state: without a reset, an earlier test's
  // observation would leak into the wall tests below and mask a regression.
  beforeEach(() => resetGtTokenPriceCacheForTests())

  it('returns lowercase address → price-string map on 200', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ attributes: { address: USDC, price_usd: '0.9982' } }] }),
    }))

    vi.stubGlobal('fetch', fakeFetch)
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    const out = await fetchGtTokenPrices(BASE, [USDC])
    expect(out[USDC]).toBe('0.9982')
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('429 is retried with backoff, then succeeds (live-probed GT wall)', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    let calls = 0

    const fakeFetch = vi.fn(async () => {
      calls += 1
      if (calls === 1) return { ok: false, status: 429, json: async () => ({}) }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: [{ attributes: { address: USDC, price_usd: '0.9982' } }] }),
      }
    })

    vi.stubGlobal('fetch', fakeFetch)
    const out = await fetchGtTokenPrices(BASE, [USDC], { retryDelaysMs: [0, 0, 0] })
    expect(out[USDC]).toBe('0.9982')
    expect(fakeFetch).toHaveBeenCalledTimes(2)
    vi.unstubAllGlobals()
  })

  it('retry budget is bounded — a persistent wall still resolves {}', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    const fakeFetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    vi.stubGlobal('fetch', fakeFetch)
    const out = await fetchGtTokenPrices(BASE, [USDC], { retryDelaysMs: [0, 0] })
    expect(out).toEqual({})
    expect(fakeFetch).toHaveBeenCalledTimes(3)
    vi.unstubAllGlobals()
  })

  it('4xx is NOT retried (a client error is final)', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    const fakeFetch = vi.fn(async () => ({ ok: false, status: 400, json: async () => ({}) }))
    vi.stubGlobal('fetch', fakeFetch)
    await fetchGtTokenPrices(BASE, [USDC], { retryDelaysMs: [0, 0] })
    expect(fakeFetch).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('non-ok / throw / empty-chain → {} (never fabricate)', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    // Zero backoff: this asserts the OUTCOME of an exhausted budget, not timing.
    const fast = { retryDelaysMs: [0, 0, 0] }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    )

    expect(await fetchGtTokenPrices(BASE, [USDC], fast)).toEqual({})

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('net')
      })
    )

    expect(await fetchGtTokenPrices(BASE, [USDC], fast)).toEqual({})
    vi.unstubAllGlobals()
    expect(await fetchGtTokenPrices('BASESEPOLIA' as never, [USDC], fast)).toEqual({})
    expect(await fetchGtTokenPrices(BASE, [], fast)).toEqual({})
  })

  /*
   * Last-good cache (live-caught 2026-11-17). GT walls the 24-address multi
   * call for LONGER than the 23s retry budget and keeps flapping 429/200 past
   * t=115s (probed: 200 x5, then 429 from call 6). An exhausted budget used to
   * return {} and the caller recorded an EMPTY SUCCESS, blanking a window that
   * had been priced seconds earlier. A cached price is a REAL observation with
   * a timestamp: served inside the TTL, never beyond, never fabricated.
   */
  it('a quota wall after a good observation serves the last-good price', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ attributes: { address: USDC, price_usd: '0.9982' } }] }),
      }))
    )

    const good = await fetchGtTokenPrices(BASE, [USDC], { now: 1_000_000 })
    expect(good[USDC]).toBe('0.9982')

    // Now the wall: every attempt 429.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }))
    )

    const walled = await fetchGtTokenPrices(BASE, [USDC], {
      now: 1_000_000 + 1_000,
      retryDelaysMs: [0],
    })

    expect(walled[USDC]).toBe('0.9982')
    vi.unstubAllGlobals()
  })

  it('the cached observation expires past the TTL — never served beyond it', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ attributes: { address: USDC, price_usd: '1.5' } }] }),
      }))
    )

    await fetchGtTokenPrices(BASE, [USDC], { now: 2_000_000 })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }))
    )

    const expired = await fetchGtTokenPrices(BASE, [USDC], {
      now: 2_000_000 + GT_PRICE_CACHE_TTL_MS + 1,
      retryDelaysMs: [0],
    })

    expect(expired).toEqual({})
    vi.unstubAllGlobals()
  })

  it('a fresh observation always beats the cache', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    let call = 0

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ attributes: { address: USDC, price_usd: call === 1 ? '1.0' : '2.0' } }],
          }),
        }
      })
    )

    const first = await fetchGtTokenPrices(BASE, [USDC], { now: 3_000_000 })
    expect(first[USDC]).toBe('1.0')

    const second = await fetchGtTokenPrices(BASE, [USDC], { now: 3_000_000 + 1_000 })
    expect(second[USDC]).toBe('2.0')
    vi.unstubAllGlobals()
  })

  it('a later 200 that drops a token does not erase the cached one', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    let call = 0

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1

        const data =
          call === 1
            ? [
                { attributes: { address: USDC, price_usd: '1.0' } },
                { attributes: { address: WETH, price_usd: '2425.47' } },
              ]
            : [{ attributes: { address: USDC, price_usd: '1.0' } }]

        return { ok: true, status: 200, json: async () => ({ data }) }
      })
    )

    await fetchGtTokenPrices(BASE, [USDC, WETH], { now: 4_000_000 })
    const second = await fetchGtTokenPrices(BASE, [USDC, WETH], { now: 4_000_000 + 1_000 })
    expect(second[USDC]).toBe('1.0')
    expect(second[WETH]).toBe('2425.47')
    vi.unstubAllGlobals()
  })
})
