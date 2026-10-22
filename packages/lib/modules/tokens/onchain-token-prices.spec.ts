import { describe, expect, it, vi, beforeEach } from 'vitest'

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

import { mergeOnchainTokenPrices, GT_NETWORK_IDS } from './onchain-token-prices'

describe('mergeOnchainTokenPrices — GT price layer for onchain-only chains', () => {
  const BASE = 'BASE' as const

  it('GT prices merge into the API price list as GqlTokenPrice-shaped entries', () => {
    const apiPrices = [{ __typename: 'GqlTokenPrice' as const, price: 2, address: '0xaaa', chain: 'MAINNET' as const, updatedAt: 1 }]
    const gtPrices = { '0xbbb': '1.5', '0xccc': '0.25' }
    const out = mergeOnchainTokenPrices(apiPrices, gtPrices, BASE)
    expect(out).toHaveLength(3)
    const bbb = out.find(p => p.address === '0xbbb')
    expect(bbb?.price).toBe(1.5)
    expect(bbb?.chain).toBe(BASE)
    expect(bbb?.__typename).toBe('GqlTokenPrice')
  })

  it('API prices WIN over GT (API remains the source of truth where it serves)', () => {
    const apiPrices = [{ __typename: 'GqlTokenPrice' as const, price: 2, address: '0xaaa', chain: BASE, updatedAt: 1 }]
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
    const apiPrices = [{ __typename: 'GqlTokenPrice' as const, price: 2, address: '0xaaa', chain: BASE, updatedAt: 1 }]
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

  it('non-ok / throw / empty-chain → {} (never fabricate)', async () => {
    const { fetchGtTokenPrices } = await import('./onchain-token-prices')
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    expect(await fetchGtTokenPrices(BASE, [USDC])).toEqual({})
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('net') }))
    expect(await fetchGtTokenPrices(BASE, [USDC])).toEqual({})
    vi.unstubAllGlobals()
    expect(await fetchGtTokenPrices('BASESEPOLIA' as never, [USDC])).toEqual({})
    expect(await fetchGtTokenPrices(BASE, [])).toEqual({})
  })
})
