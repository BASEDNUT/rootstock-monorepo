import { describe, expect, it } from 'vitest'
import {
  aggregateSwapBuckets,
  computePoolMetrics,
  decodeSwapLogsToBuckets,
  deriveUnpricedTokenPrices,
} from './onchain-metrics'

const HOUR = 3_600_000

/*
 * Rootstock onchain dynamic metrics — pure computation layer.
 *
 * Laws (auditor round-2 FIX-3 lineage): never fabricate. Unavailable
 * metric = null → renders as '—'. A genuine 0 (no swaps in a COVERED
 * 24h window) is a real value and stays.
 *
 * Fee source truth (source-verified in frozen V3, Vault.sol
 * _computeAndChargeAggregateSwapFees): _aggregateFeeAmounts stores ONLY
 * the aggregate share (protocol+creator) — with aggregate % = 0 the
 * counters stay 0 forever. Therefore fees/volume come from Vault Swap
 * EVENTS, which carry the FULL swapFeeAmount + amountIn.
 *
 * Ledger: hourly buckets per (pool, token); baked histogram at build
 * time (full history via archive RPC) + visitor localStorage extension
 * (recent-window scans). hasFullCoverage gates fees/volume/APR.
 */

const U = (n: number) => BigInt(n) * 10n ** 18n
const UF = (n: number) => BigInt(Math.round(n * 1e18)) // fractional 18-dec raw

describe('deriveUnpricedTokenPrices (weighted spot derivation)', () => {
  it('derives unpriced sibling prices from one priced anchor', () => {
    const tokens = [
      { address: '0xwnut', decimals: 18 },
      { address: '0xnvda', decimals: 18 },
      { address: '0xaapl', decimals: 18 },
    ]

    const balancesRaw = [U(1), U(10), U(12)]
    const weights = [0.2, 0.4, 0.4]
    const prices = { '0xwnut': 29000 }
    const derived = deriveUnpricedTokenPrices({ tokens, balancesRaw, weights, prices })
    expect(derived['0xnvda']).toBeCloseTo((29000 * 1 * 0.4) / (10 * 0.2), 6)
    expect(derived['0xaapl']).toBeCloseTo((29000 * 1 * 0.4) / (12 * 0.2), 6)
  })

  it('keeps already-priced tokens untouched (derived map is additive)', () => {
    const tokens = [
      { address: '0xa', decimals: 18 },
      { address: '0xb', decimals: 18 },
    ]

    const balancesRaw = [U(1), U(2)]
    const weights = [0.5, 0.5]
    const known = { '0xa': 5, '0xb': 7 }
    const derived = deriveUnpricedTokenPrices({ tokens, balancesRaw, weights, prices: known })
    expect(derived['0xa']).toBeUndefined()
    expect(known['0xa']).toBe(5)
    expect(known['0xb']).toBe(7)
  })

  it('returns empty when no anchor is priced', () => {
    const derived = deriveUnpricedTokenPrices({
      tokens: [{ address: '0xa', decimals: 18 }, { address: '0xb', decimals: 18 }],
      balancesRaw: [U(1), U(1)],
      weights: [0.5, 0.5],
      prices: {},
    })

    expect(Object.keys(derived)).toHaveLength(0)
  })

  it('returns empty when weights are null (reCLAMM)', () => {
    const derived = deriveUnpricedTokenPrices({
      tokens: [{ address: '0xa', decimals: 18 }],
      balancesRaw: [U(1)],
      weights: null,
      prices: {},
    })

    expect(Object.keys(derived)).toHaveLength(0)
  })

  it('normalizes balances by per-token decimals (SNUT 9)', () => {
    const tokens = [
      { address: '0xwnut', decimals: 18 },
      { address: '0xsnut', decimals: 9 },
    ]

    const balancesRaw = [U(1), BigInt(5) * 10n ** 9n] // 1 wNUT, 5 SNUT

    const derived = deriveUnpricedTokenPrices({
      tokens,
      balancesRaw,
      weights: [0.5, 0.5],
      prices: { '0xwnut': 100 },
    })

    expect(derived['0xsnut']).toBeCloseTo(20, 6)
  })
})

describe('decodeSwapLogsToBuckets', () => {
  it('decodes raw eth_getLogs Swap entries into hourly buckets', () => {
    const hour = Math.floor(Date.now() / HOUR)
    const pool = '0xpool1'.toLowerCase()
    const tokenIn = '0xtokA'.toLowerCase()

    const data =
      '0x' +
      U(100).toString(16).padStart(64, '0') + // amountIn
      U(95).toString(16).padStart(64, '0') + // amountOut
      (0.003e18).toString(16).padStart(64, '0') + // feePct
      UF(0.3).toString(16).padStart(64, '0') // feeAmount

    const logs = [
      {
        blockNumber: '0x' + (1000).toString(16),
        topics: [
          '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db',
          '0x' + pool.slice(2).padStart(64, '0'),
          '0x' + tokenIn.slice(2).padStart(64, '0'),
          '0x' + '0xtokB'.slice(2).padStart(64, '0'),
        ],
        data,
      },
    ]

    const buckets = decodeSwapLogsToBuckets(logs, () => hour * HOUR)
    expect(buckets).toHaveLength(1)

    expect(buckets[0]!).toMatchObject({
      hour,
      pool,
      token: tokenIn,
      amountInRaw: U(100).toString(),
      feeAmountRaw: UF(0.3).toString(),
    })
  })

  it('aggregates two swaps in the same hour into one bucket', () => {
    const pool = '0xpool1'
    const token = '0xtokA'

    const mk = (amt: number) =>
      '0x' +
      U(amt).toString(16).padStart(64, '0') +
      U(1).toString(16).padStart(64, '0') +
      (1e16).toString(16).padStart(64, '0') +
      U(1).toString(16).padStart(64, '0')

    const logs = [
      { blockNumber: '0x1', topics: ['0xt', '0x' + pool.slice(2).padStart(64, '0'), '0x' + token.slice(2).padStart(64, '0'), '0x2'], data: mk(10) },
      { blockNumber: '0x2', topics: ['0xt', '0x' + pool.slice(2).padStart(64, '0'), '0x' + token.slice(2).padStart(64, '0'), '0x2'], data: mk(25) },
    ]

    const buckets = decodeSwapLogsToBuckets(logs, () => 5 * HOUR)
    expect(buckets).toHaveLength(1)
    expect(buckets[0]!.amountInRaw).toBe(U(35).toString())
  })

  it('skips malformed logs (missing topics/data)', () => {
    const logs = [
      { blockNumber: '0x1', topics: ['0xonly-one'], data: '0x' },
      { blockNumber: '0x1', topics: ['0xt', '0xa'.padStart(64, '0'), '0xb'.padStart(64, '0'), '0xc'.padStart(64, '0')], data: '0xshort' },
    ]

    expect(decodeSwapLogsToBuckets(logs, () => 0)).toHaveLength(0)
  })
})

describe('aggregateSwapBuckets', () => {
  it('sums USD volume+fees over the trailing 24h window for one pool', () => {
    const now = 100 * 24 * HOUR
    const pool = '0xpool1'

    const buckets = [
      { hour: Math.floor((now - 30 * HOUR) / HOUR), pool, token: '0xa', amountInRaw: U(1000).toString(), feeAmountRaw: U(3).toString() },
      { hour: Math.floor((now - 23 * HOUR) / HOUR), pool, token: '0xa', amountInRaw: U(100).toString(), feeAmountRaw: UF(0.3).toString() },
      { hour: Math.floor((now - 2 * HOUR) / HOUR), pool, token: '0xb', amountInRaw: U(50).toString(), feeAmountRaw: UF(0.15).toString() },
    ]

    const prices = { '0xa': 10, '0xb': 2 }
    const agg = aggregateSwapBuckets({ pool, buckets, prices, now })
    // window: hours 76..100 (last 24h): 100*10 + 50*2 = 1100 volume
    expect(agg.volumeUsd).toBeCloseTo(1100, 6)
    expect(agg.feesUsd).toBeCloseTo(0.3 * 10 + 0.15 * 2, 6)
  })

  it('normalizes non-18-decimal tokens (USDC 6)', () => {
    const now = 100 * 24 * HOUR

    const agg = aggregateSwapBuckets({
      pool: '0xpool1',
      buckets: [
        {
          hour: Math.floor(now / HOUR) - 1,
          pool: '0xpool1',
          token: '0xusdc',
          amountInRaw: (2n * 10n ** 6n).toString(),
          feeAmountRaw: (6_000n).toString(),
        },
      ],
      prices: { '0xusdc': 1 },
      decimals: { '0xusdc': 6 },
      now,
    })

    expect(agg.volumeUsd).toBeCloseTo(2, 6)
    expect(agg.feesUsd).toBeCloseTo(0.006, 6)
  })

  it('ignores buckets from other pools', () => {
    const now = 100 * 24 * HOUR

    const agg = aggregateSwapBuckets({
      pool: '0xpool1',
      buckets: [{ hour: Math.floor(now / HOUR) - 1, pool: '0xother', token: '0xa', amountInRaw: U(999).toString(), feeAmountRaw: U(9).toString() }],
      prices: { '0xa': 10 },
      now,
    })

    expect(agg.volumeUsd).toBe(0)
    expect(agg.feesUsd).toBe(0)
  })
})

describe('computePoolMetrics', () => {
  const tokens = [
    { address: '0xa', decimals: 18 },
    { address: '0xb', decimals: 18 },
  ]

  const balancesRaw = [U(1), U(20)] // 1 A, 20 B
  const weights = [0.5, 0.5]
  const prices = { '0xa': 10, '0xb': 0.5 } // TVL = $20

  it('computes TVL from priced balances', () => {
    const m = computePoolMetrics({
      poolId: '0xpool',
      tokens,
      balancesRaw,
      weights,
      prices,
      buckets: [],
      hasFullCoverage: true,
      now: 0,
    })

    expect(m.totalLiquidity).toBe('20')
    expect(m.volume24h).toBe('0')
    expect(m.fees24h).toBe('0')
    expect(m.aprItems).toHaveLength(1)
    expect(m.aprItems[0]!.apr).toBe(0)
  })

  it('derives missing prices via weights before TVL', () => {
    const m = computePoolMetrics({
      poolId: '0xpool',
      tokens,
      balancesRaw,
      weights,
      prices: { '0xa': 10 }, // 0xb derived → 0.5
      buckets: [],
      hasFullCoverage: true,
      now: 0,
    })

    expect(m.totalLiquidity).toBe('20')
  })

  it('TVL null when a token has no price path', () => {
    const m = computePoolMetrics({
      poolId: '0xpool',
      tokens,
      balancesRaw,
      weights: null, // reCLAMM: no derivation
      prices: { '0xa': 10 },
      buckets: [],
      hasFullCoverage: true,
      now: 0,
    })

    expect(m.totalLiquidity).toBeNull()
  })

  it('fees/volume from covered 24h buckets; APR in percent', () => {
    const now = 100 * 24 * HOUR
    const pool = '0xpool'

    const buckets = [
      { hour: Math.floor((now - 25 * HOUR) / HOUR), pool, token: '0xa', amountInRaw: U(10000).toString(), feeAmountRaw: U(30).toString() },
      { hour: Math.floor((now - 2 * HOUR) / HOUR), pool, token: '0xa', amountInRaw: U(100).toString(), feeAmountRaw: UF(0.3).toString() },
    ]

    const m = computePoolMetrics({
      poolId: pool,
      tokens,
      balancesRaw,
      weights,
      prices,
      buckets,
      hasFullCoverage: true,
      now,
    })

    // volume = 100*10 (25h-old bucket is OUTSIDE 24h window; only 100 counts)
    expect(m.volume24h).toBe('1000')
    expect(m.fees24h).toBe('3')
    // APR% = feesUsd*365/TVL*100 = 3*365/20*100 = 5475
    expect(m.aprItems[0]?.apr).toBeCloseTo(5475, 2)
    expect(m.aprItems[0]?.type).toBe('SWAP_FEE_24H')
    expect(m.aprItems[0]?.id).toBe(`${pool}-swap-fee-24h`)
  })

  it('no coverage → fees/volume/APR null, TVL still real', () => {
    const m = computePoolMetrics({
      poolId: '0xpool',
      tokens,
      balancesRaw,
      weights,
      prices,
      buckets: [],
      hasFullCoverage: false,
      now: 0,
    })

    expect(m.totalLiquidity).toBe('20')
    expect(m.volume24h).toBeNull()
    expect(m.fees24h).toBeNull()
    expect(m.aprItems).toEqual([])
  })

  it('buckets present but uncovered ledger still reports the events it has', () => {
    // a cold visitor without the baked base has seen SOME swaps —
    // report them (understated-but-real beats em-dash once trading exists)
    const now = 100 * 24 * HOUR

    const m = computePoolMetrics({
      poolId: '0xpool',
      tokens,
      balancesRaw,
      weights,
      prices,
      buckets: [{ hour: Math.floor(now / HOUR) - 1, pool: '0xpool', token: '0xa', amountInRaw: U(5).toString(), feeAmountRaw: UF(0.015).toString() }],
      hasFullCoverage: false,
      now,
    })

    expect(m.volume24h).toBe('50')
    expect(m.aprItems).toEqual([]) // APR only on full coverage
  })

  it('fees null when a bucket token has no price (never fabricate USD)', () => {
    const now = 100 * 24 * HOUR

    const m = computePoolMetrics({
      poolId: '0xpool',
      tokens: [{ address: '0xa', decimals: 18 }],
      balancesRaw: [U(1)],
      weights: null,
      prices: {},
      buckets: [{ hour: Math.floor(now / HOUR) - 1, pool: '0xpool', token: '0xa', amountInRaw: U(5).toString(), feeAmountRaw: U(1).toString() }],
      hasFullCoverage: true,
      now,
    })

    expect(m.fees24h).toBeNull()
    expect(m.volume24h).toBeNull()
    expect(m.totalLiquidity).toBeNull()
  })
})
