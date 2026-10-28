import { describe, expect, it } from 'vitest'
import { mergeBuckets } from './onchain-metrics-store'
import { computePoolMetrics, aggregateSwapBuckets, type SwapBucket } from './onchain-metrics'

/**
 * D3 (live-caught 2026-10-27): mergeBuckets used later-wins semantics —
 * disjoint-range sources (baked ledger [deploy, bakedCursor] + visitor scan
 * [maxCursor, tip]) produce two buckets for the SAME hour|pool|token key,
 * and the visitor bucket REPLACED the baked one, silently dropping every
 * pre-cursor event in a straddling hour. All sources are provably disjoint
 * by construction (fromBlock = max(all cursors) + 1), so the merge MUST
 * sum. No source can ever re-cover another's range after this change:
 * the ledger store v3 keeps ONLY visitor-scan buckets.
 */

const HOUR_MS = 3_600_000
const hour = (ms: number) => Math.floor(ms / HOUR_MS)
const now = 1_800_000_000_000

const bucket = (
  h: number,
  pool: string,
  token: string,
  amount: string,
  fee: string
): SwapBucket => ({
  hour: h,
  pool,
  token,
  amountInRaw: amount,
  feeAmountRaw: fee,
})

const POOL = '0x' + 'a'.repeat(40)
const TOKEN = '0x' + 'b'.repeat(40)
const DEC: Record<string, number> = { [TOKEN]: 18 }
const PRICE: Record<string, number> = { [TOKEN]: 1 }

describe('mergeBuckets — sum semantics for disjoint sources (D3)', () => {
  it('same-key buckets SUM amountIn and feeAmount (baked + visitor straddling hour)', () => {
    const baked = bucket(hour(now) - 2, POOL, TOKEN, '1000', '10')
    const visitor = bucket(hour(now) - 2, POOL, TOKEN, '250', '3')
    const merged = mergeBuckets([baked], [visitor])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.amountInRaw).toBe('1250')
    expect(merged[0]!.feeAmountRaw).toBe('13')
  })

  it('three-way merge sums across baked + stored + fresh scan', () => {
    const a = bucket(hour(now) - 1, POOL, TOKEN, '10', '1')
    const b = bucket(hour(now) - 1, POOL, TOKEN, '20', '2')
    const c = bucket(hour(now) - 1, POOL, TOKEN, '30', '3')
    const merged = mergeBuckets(mergeBuckets([a], [b]), [c])
    expect(merged).toHaveLength(1)
    expect(merged[0]!.amountInRaw).toBe('60')
    expect(merged[0]!.feeAmountRaw).toBe('6')
  })

  it('distinct keys stay distinct (no cross-contamination)', () => {
    const p1 = bucket(hour(now), POOL, TOKEN, '5', '0')
    const p2 = bucket(hour(now), '0x' + 'c'.repeat(40), TOKEN, '7', '0')
    const merged = mergeBuckets([p1], [p2])
    expect(merged).toHaveLength(2)
  })

  it('end-to-end: baked + visitor sum survives full metric aggregation', () => {
    const baked = bucket(hour(now) - 1, POOL, TOKEN, '1000000000000000000', '10000000000000000')
    const visitor = bucket(hour(now) - 1, POOL, TOKEN, '500000000000000000', '5000000000000000')
    const merged = mergeBuckets([baked], [visitor])

    const agg = aggregateSwapBuckets({
      pool: POOL,
      buckets: merged,
      prices: PRICE,
      decimals: DEC,
      now,
    })

    expect(agg.volumeUsd).toBe(1.5)
    expect(agg.feesUsd).toBe(0.015)
  })

  it('empty inputs tolerated on both sides', () => {
    expect(mergeBuckets([], [])).toEqual([])
    expect(mergeBuckets([bucket(1, POOL, TOKEN, '1', '0')], [])).toHaveLength(1)
  })
})

describe('computePoolMetrics — supersede law (D3)', () => {
  it('hasFullCoverage=false reports observed events understated-but-real (volume > 0 kept)', () => {
    const tokens = [{ address: TOKEN, decimals: 18 }]

    const res = computePoolMetrics({
      poolId: POOL,
      tokens,
      balancesRaw: [1_000_000_000n],
      weights: [1],
      prices: PRICE,
      buckets: [bucket(hour(now) - 1, POOL, TOKEN, '1000000000000000000', '10000000000000000')],
      hasFullCoverage: false,
      now,
    })

    expect(res.volume24h).not.toBeNull()
    expect(Number(res.volume24h)).toBeGreaterThan(0)
  })

  it('hasFullCoverage=false + zero observed → null (never a fake $0.00)', () => {
    const tokens = [{ address: TOKEN, decimals: 18 }]

    const res = computePoolMetrics({
      poolId: POOL,
      tokens,
      balancesRaw: [1_000_000_000n],
      weights: [1],
      prices: PRICE,
      buckets: [],
      hasFullCoverage: false,
      now,
    })

    expect(res.volume24h).toBeNull()
    expect(res.fees24h).toBeNull()
  })
})
