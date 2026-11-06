/**
 * Derived USD prices — tokens GeckoTerminal does not price.
 *
 * Verified on-chain + live 2026-11-04 (S134d):
 *  - wNUT (0xba5e…) is NOT ERC4626: convertToAssets / asset / totalAssets
 *    all revert. It is an OZ ERC20Wrapper — underlying() == NUT, 18 dec,
 *    1:1 by construction. So price(wNUT) == price(NUT), exactly.
 *  - GT returns wNUT with price_usd = null and lists it as neither base nor
 *    quote in any of its 3 pools.
 *  - PIPS (0x3f23…) also has price_usd = null, but its PIPS/NUT pool does
 *    carry base_token_price_usd (0.000006284… live). The pool endpoint
 *    resolves it by exact identity match on relationships.base_token.
 *
 * Laws: derive only from a real on-chain relationship or a real GT pool
 * price. Never extrapolate from a hardcoded constant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  augmentWithDerivedPrices,
  deriveWrapperPrices,
  pickPoolPriceUsd,
  resetPoolPriceCacheForTests,
} from './onchain-derived-prices'

const CHAIN = GqlChainValues.Base
const NUT = '0xb8de15fb529d98c93c749de63c749d48d25a30df'
const WNUT = '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3'
const PIPS = '0x3f2327221dd4f0bae660172606d6b288a1cf8ad9'
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

function poolsResponse(data: unknown[]) {
  return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response
}

beforeEach(() => resetPoolPriceCacheForTests())
afterEach(() => vi.unstubAllGlobals())

describe('deriveWrapperPrices (1:1 ERC20Wrapper)', () => {
  it('prices wNUT exactly at the NUT anchor', () => {
    const derived = deriveWrapperPrices({ [NUT]: 26502.52 })
    expect(derived[WNUT]).toBeCloseTo(26502.52, 6)
  })

  it('never overwrites a price the source already provided', () => {
    const derived = deriveWrapperPrices({ [NUT]: 26502.52, [WNUT]: 1 })
    expect(derived[WNUT]).toBeUndefined()
  })

  it('derives nothing when the underlying is unpriced', () => {
    expect(deriveWrapperPrices({})).toEqual({})
  })

  it('ignores a non-positive underlying price', () => {
    expect(deriveWrapperPrices({ [NUT]: 0 })).toEqual({})
  })
})

describe('pickPoolPriceUsd (GT pool rows)', () => {
  const basePool = {
    attributes: {
      base_token_price_usd: '0.000006284',
      quote_token_price_usd: '26731.9',
      reserve_in_usd: '384.17',
    },
    relationships: {
      base_token: { data: { id: `base_${PIPS}` } },
      quote_token: { data: { id: `base_${NUT}` } },
    },
  }

  const quotePool = {
    attributes: {
      base_token_price_usd: '0.99',
      quote_token_price_usd: '0.000006765',
      reserve_in_usd: '112.22',
    },
    relationships: {
      base_token: { data: { id: `base_${USDC}` } },
      quote_token: { data: { id: `base_${PIPS}` } },
    },
  }

  it('reads base_token_price_usd when the token is the base', () => {
    expect(pickPoolPriceUsd(PIPS, [basePool])).toBeCloseTo(0.000006284, 12)
  })

  it('reads quote_token_price_usd when the token is the quote', () => {
    expect(pickPoolPriceUsd(PIPS, [quotePool])).toBeCloseTo(0.000006765, 12)
  })

  it('prefers the deepest pool when the token appears in several', () => {
    expect(pickPoolPriceUsd(PIPS, [quotePool, basePool])).toBeCloseTo(0.000006284, 12)
  })

  it('returns null when no pool references the token', () => {
    expect(pickPoolPriceUsd('0x' + 'c'.repeat(40), [basePool, quotePool])).toBeNull()
  })

  it('skips a pool whose matched price is missing', () => {
    const broken = {
      ...basePool,
      attributes: { ...basePool.attributes, base_token_price_usd: null },
    }

    expect(pickPoolPriceUsd(PIPS, [broken])).toBeNull()
  })
})

describe('augmentWithDerivedPrices', () => {
  it('fills wNUT from NUT without any network call', async () => {
    const fn = vi.fn()
    vi.stubGlobal('fetch', fn)

    const prices = await augmentWithDerivedPrices({
      chain: CHAIN,
      addresses: [NUT, WNUT],
      prices: { [NUT]: 26502.52 },
    })

    expect(prices[WNUT]).toBeCloseTo(26502.52, 6)
    expect(fn).not.toHaveBeenCalled()
  })

  it('resolves a genuinely unpriced token from its GT pool', async () => {
    const row = {
      attributes: {
        base_token_price_usd: '0.000006284',
        quote_token_price_usd: '26731.9',
        reserve_in_usd: '384.17',
      },
      relationships: {
        base_token: { data: { id: `base_${PIPS}` } },
        quote_token: { data: { id: `base_${NUT}` } },
      },
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(poolsResponse([row])))

    const prices = await augmentWithDerivedPrices({
      chain: CHAIN,
      addresses: [NUT, WNUT, PIPS],
      prices: { [NUT]: 26502.52 },
    })

    expect(prices[PIPS]).toBeCloseTo(0.000006284, 12)
  })

  it('leaves a token unpriced when its pool lookup finds nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(poolsResponse([])))

    const prices = await augmentWithDerivedPrices({
      chain: CHAIN,
      addresses: [PIPS],
      prices: {},
    })

    expect(prices[PIPS]).toBeUndefined()
  })

  it('reuses a cached pool price inside the TTL', async () => {
    const row = {
      attributes: {
        base_token_price_usd: '0.000006284',
        quote_token_price_usd: '1',
        reserve_in_usd: '384',
      },
      relationships: {
        base_token: { data: { id: `base_${PIPS}` } },
        quote_token: { data: { id: `base_${USDC}` } },
      },
    }

    const fn = vi.fn().mockResolvedValue(poolsResponse([row]))
    vi.stubGlobal('fetch', fn)

    await augmentWithDerivedPrices({ chain: CHAIN, addresses: [PIPS], prices: {}, now: 1_000 })

    const second = await augmentWithDerivedPrices({
      chain: CHAIN,
      addresses: [PIPS],
      prices: {},
      now: 1_000 + 60_000,
    })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(second[PIPS]).toBeCloseTo(0.000006284, 12)
  })
})
