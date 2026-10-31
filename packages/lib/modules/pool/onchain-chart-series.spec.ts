import { describe, expect, it } from 'vitest'
import { buildOnchainChartSeries } from './onchain-pool-chart-series'
import type { SwapBucket } from './onchain-metrics'

/*
 * B5 (2026-10-31): chart VOLUME/FEES series from swap-ledger buckets —
 * day bucketing law, understated-but-real pricing law, today-TVL-only law.
 */

const POOL = '0xpool1'
const T = '0xtokenA'

const bucket = (hour: number, amountInRaw: string, feeAmountRaw: string): SwapBucket => ({
  hour,
  pool: POOL,
  token: T,
  amountInRaw,
  feeAmountRaw,
})

describe('buildOnchainChartSeries', () => {
  const prices = { [T]: 2 } // $2/token
  const decimals = { [T]: 18 }

  it('buckets hourly events into UTC-midnight day points, priced', () => {
    const h0 = Math.floor(1_800_000_000_000 / 3_600_000)
    const b1 = bucket(h0, '1000000000000000000', '30000000000000000') // 1 token
    const b2 = bucket(h0 + 5, '500000000000000000', '15000000000000000') // 0.5
    const day2h = h0 + 25
    const b3 = bucket(day2h, '1000000000000000000', '30000000000000000')

    const out = buildOnchainChartSeries({
      buckets: [b1, b2, b3],
      pool: POOL,
      prices,
      decimals,
      now: (day2h + 1) * 3_600_000,
      totalLiquidity: '123.45',
    })

    expect(out).toHaveLength(2) // two distinct days
    const day1 = out[0]!
    expect(day1!.volume24h).toBe('3') // (1+0.5)*$2
    expect(day1.fees24h).toBe('0.09') // (0.03+0.015)*$2
    // older day: no TVL fabrication
    expect(day1.totalLiquidity).toBe('0')
    // newest day carries live TVL
    expect(out[1]!.totalLiquidity).toBe('123.45')
  })

  it('understated-but-real: unpriced tokens skipped, never zero-priced', () => {
    const h = Math.floor(1_800_000_000_000 / 3_600_000)

    const out = buildOnchainChartSeries({
      buckets: [bucket(h, '1000000000000000000', '0')],
      pool: POOL,
      prices: {}, // no price
      decimals,
      now: (h + 1) * 3_600_000,
      totalLiquidity: null,
    })

    expect(out).toHaveLength(0)
  })

  it('filters buckets to the requested pool only', () => {
    const h = Math.floor(1_800_000_000_000 / 3_600_000)
    const other = { ...bucket(h, '1000000000000000000', '0'), pool: '0xother' }

    const out = buildOnchainChartSeries({
      buckets: [other, bucket(h, '1000000000000000000', '0')],
      pool: POOL,
      prices,
      decimals,
      now: (h + 1) * 3_600_000,
      totalLiquidity: null,
    })

    expect(out).toHaveLength(1)
    expect(out[0]!.volume24h).toBe('2')
  })

  it('empty input → empty series (honest, never fabricated)', () => {
    expect(
      buildOnchainChartSeries({
        buckets: [],
        pool: POOL,
        prices,
        decimals,
        now: 1,
        totalLiquidity: '1',
      })
    ).toHaveLength(0)
  })
})
