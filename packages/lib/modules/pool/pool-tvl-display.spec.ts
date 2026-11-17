import { describe, expect, it } from 'vitest'
import { resolvePoolTvlDisplay } from './pool-metrics'

/**
 * Live-caught 2026-11-17 (W6 E2E, 16/24 vs 12-of-15 across runs): the pool
 * detail "Total liquidity" block rendered a fabricated $0.00 whenever the
 * token-price layer had not resolved yet, and rendered an endless Skeleton
 * when the price layer resolved to nothing at all. Failure was BINARY, not
 * slow: instant $0.00 or nothing for the whole 75s window.
 *
 * Contract: UNRESOLVED never renders as $0.00; a REAL zero still does.
 * - isLoadingPrices                  -> 'pending'      (skeleton)
 * - no composition tokens            -> 'unavailable'  (—)
 * - every token unpriced             -> 'unavailable'  (—)
 * - some tokens unpriced             -> 'value'        (understated-but-real + warning)
 * - all priced, sum 0                -> 'zero'         ($0.00 is the truth)
 * - all priced, sum > 0              -> 'value'
 */
describe('resolvePoolTvlDisplay — UNRESOLVED vs REAL zero', () => {
  const base = { tokenCount: 3, unpricedTokenCount: 0, isLoadingPrices: false }

  it('price layer still loading -> pending, never a fabricated zero', () => {
    const out = resolvePoolTvlDisplay({
      ...base,
      totalLiquidity: '0',
      isLoadingPrices: true,
    })

    expect(out.state).toBe('pending')
  })

  it('every composition token unpriced -> unavailable, not zero', () => {
    const out = resolvePoolTvlDisplay({
      ...base,
      totalLiquidity: '0',
      unpricedTokenCount: 3,
    })

    expect(out.state).toBe('unavailable')
  })

  it('pool with no composition tokens -> unavailable, not zero', () => {
    const out = resolvePoolTvlDisplay({
      totalLiquidity: '0',
      tokenCount: 0,
      unpricedTokenCount: 0,
      isLoadingPrices: false,
    })

    expect(out.state).toBe('unavailable')
  })

  it('a REAL onchain zero still renders as zero', () => {
    const out = resolvePoolTvlDisplay({ ...base, totalLiquidity: '0' })
    expect(out.state).toBe('zero')
  })

  it('a real positive TVL renders as value', () => {
    const out = resolvePoolTvlDisplay({ ...base, totalLiquidity: '0.9812' })
    expect(out.state).toBe('value')
  })

  it('partial pricing keeps the understated-but-real number', () => {
    const out = resolvePoolTvlDisplay({
      ...base,
      totalLiquidity: '0.42',
      unpricedTokenCount: 1,
    })

    expect(out.state).toBe('value')
  })

  it('null/undefined TVL with prices loaded -> unavailable, not zero', () => {
    expect(resolvePoolTvlDisplay({ ...base, totalLiquidity: null }).state).toBe('unavailable')
    expect(resolvePoolTvlDisplay({ ...base, totalLiquidity: undefined }).state).toBe('unavailable')
    expect(resolvePoolTvlDisplay({ ...base, totalLiquidity: '' }).state).toBe('unavailable')
  })

  it('malformed TVL is treated as unavailable, never coerced to zero', () => {
    expect(resolvePoolTvlDisplay({ ...base, totalLiquidity: 'not-a-number' }).state).toBe(
      'unavailable'
    )
  })
})
