import { describe, expect, it } from 'vitest'
import {
  buildOnchainPoolEvents,
  buildOnchainPoolEventsAsGqlEvents,
  type BakedPoolEvent,
} from './onchain-pool-events-builder'

/*
 * B2c client side: the baked events artifact (raw amounts) + registry
 * decimals + GT prices → the GqlPoolEvent-minimal shape usePoolActivity
 * consumes (adds/removes/swaps arrays). Raw bake fields:
 *   ADD/REMOVE: { pool, tx, timestamp, block, type, userAddress, kind,
 *                totalSupply, amountsRaw: string[] }
 *   SWAP: { pool, tx, timestamp, block, type, userAddress, tokenIn, tokenOut,
 *           amountInRaw, amountOutRaw }
 */

const DECIMALS = {
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 18,
  '0xac130701aa31c284c36609e2489f150f419ad7ad': 9,
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8,
  '0x3f2327221dd4f0bae660172606d6b288a1cf8ad9': 18,
  '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3': 18, // wNUT
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6,
}

const PRICES = {
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 2820,
  '0xac130701aa31c284c36609e2489f150f419ad7ad': 0.051,
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 84300,
  '0x3f2327221dd4f0bae660172606d6b288a1cf8ad9': 6.4e-6,
  '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3': 29358, // wNUT
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 1,
}

const PNUT_TOKENS = [
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
  '0xac130701aa31c284c36609e2489f150f419ad7ad',
  '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3',
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
]

const ADD: BakedPoolEvent = {
  pool: '0xf64ae6f64be7c223092c399dfd2e388db5e16080',
  tx: '0x013c7fbd1eb081318430904595628c9248b87eff26b0b6b43e41874588b0ae61',
  timestamp: 1792616093,
  block: 52913373,
  type: 'ADD',
  userAddress: '0x135b208ac2480b0d876944416de16e7a3b9a1f65',
  kind: 1,
  totalSupply: '53885789500629849',
  amountsRaw: ['13996348971770438', '771690000000', '1450000000000000', '47139'],
}

const SWAP: BakedPoolEvent = {
  pool: '0xf8e5ca8397ed7fa5c17ebd73c3b42660abf62c53',
  tx: '0x5e9459d130b20356b34e246bb95a6aa81b0d8a4b3cfe39c22a4d796f4005fd48',
  timestamp: 1792207997,
  block: 52709325,
  type: 'SWAP',
  userAddress: '0x135b208ac2480b0d876944416de16e7a3b9a1f65',
  tokenIn: '0x3f2327221dd4f0bae660172606d6b288a1cf8ad9',
  tokenOut: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  amountInRaw: '1507953378729272634295579',
  amountOutRaw: '16835074',
}

describe('buildOnchainPoolEvents — baked raw events → activity shape (B2c)', () => {
  it('ADD: decodes amounts with per-token decimals, USD from prices', () => {
    const out = buildOnchainPoolEvents({
      events: [ADD],
      poolId: ADD.pool,
      poolTokens: PNUT_TOKENS,
      decimals: DECIMALS,
      prices: PRICES,
    })

    expect(out.adds).toHaveLength(1)
    expect(out.removes).toHaveLength(0)
    expect(out.swaps).toHaveLength(0)

    const add = out.adds[0]!
    expect(add.timestamp).toBe(1792616093)
    expect(add.tx).toBe(ADD.tx)
    expect(add.userAddress).toBe(ADD.userAddress)
    // cbETH 18d: 13996348971770438 raw → 13.996348971770438
    // SNUT 9d: 771690000000 raw → 771.69
    const snut = add.tokens.find(t => t.address === '0xac130701aa31c284c36609e2489f150f419ad7ad')
    expect(snut?.amount).toBe('771.69')
    const cbbtc = add.tokens.find(t => t.address === '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf')
    expect(cbbtc?.amount).toBe('0.00047139')
    // valueUSD = sum(raw/10^dec * price) — full 4-leg valuation ≈ $161
    expect(add.valueUSD).toBeGreaterThan(160)
  })

  it('SWAP: decodes tokenIn/tokenOut, USD = max leg value', () => {
    const out = buildOnchainPoolEvents({
      events: [SWAP],
      poolId: SWAP.pool,
      poolTokens: [SWAP.tokenIn!, SWAP.tokenOut!],
      decimals: DECIMALS,
      prices: PRICES,
    })

    expect(out.swaps).toHaveLength(1)
    const swap = out.swaps[0]!
    expect(swap.tokenIn.amount).toBe('1507953.378729272')
    expect(swap.tokenOut.amount).toBe('16.835074')
    // PIPS in ≈ 1507953 * 6.4e-6 ≈ $9.65; USDC out ≈ $16.84 → max = 16.84
    expect(swap.valueUSD).toBeCloseTo(16.835074, 4)
  })

  it('filters to the requested pool; other pools are excluded', () => {
    const out = buildOnchainPoolEvents({
      events: [ADD, SWAP],
      poolId: ADD.pool,
      poolTokens: PNUT_TOKENS,
      decimals: DECIMALS,
      prices: PRICES,
    })
    expect(out.adds).toHaveLength(1)
    expect(out.swaps).toHaveLength(0)
  })

  it('missing prices → valueUSD 0 (honest, never fabricated)', () => {
    const out = buildOnchainPoolEvents({
      events: [ADD],
      poolId: ADD.pool,
      poolTokens: PNUT_TOKENS,
      decimals: DECIMALS,
      prices: {},
    })
    expect(out.adds[0]!.valueUSD).toBe(0)
  })

  it('empty events → all-empty result (no crash)', () => {
    const out = buildOnchainPoolEvents({ events: [], poolId: '0xabc', poolTokens: [], decimals: {}, prices: {} })
    expect(out).toEqual({ adds: [], removes: [], swaps: [] })
  })

  it('events sorted newest-first within their bucket', () => {
    const older = { ...ADD, block: 52900000, timestamp: 1792500000 }
    const out = buildOnchainPoolEvents({
      events: [older, ADD],
      poolId: ADD.pool,
      poolTokens: PNUT_TOKENS,
      decimals: DECIMALS,
      prices: PRICES,
    })
    expect(out.adds[0]!.timestamp).toBeGreaterThan(out.adds[1]!.timestamp)
  })
})

describe('buildOnchainPoolEventsAsGqlEvents — GqlPoolEvent shape for the activity reduce (B2c)', () => {
  it('ADD → GqlPoolAddRemoveEventV3 shape (tokens carry valueUSD)', () => {
    const gql = buildOnchainPoolEventsAsGqlEvents({
      events: [ADD],
      poolId: ADD.pool,
      poolTokens: PNUT_TOKENS,
      decimals: DECIMALS,
      prices: PRICES,
    })
    expect(gql).toHaveLength(1)
    const e = gql[0]!
    expect(e.__typename).toBe('GqlPoolAddRemoveEventV3')
    expect(e.type).toBe('ADD')
    expect(e.id).toContain(ADD.tx)
    expect(e.poolId).toBe(ADD.pool)
    const addEvent = e as unknown as { tokens: { address: string; amount: string; valueUSD: number }[] }
    expect(addEvent.tokens).toHaveLength(4)
    expect(addEvent.tokens.find(t => t.address === '0xac130701aa31c284c36609e2489f150f419ad7ad')?.amount).toBe('771.69')
  })

  it('SWAP → GqlPoolSwapEventV3 shape (tokenIn/tokenOut)', () => {
    const gql = buildOnchainPoolEventsAsGqlEvents({
      events: [SWAP],
      poolId: SWAP.pool,
      poolTokens: [SWAP.tokenIn!, SWAP.tokenOut!],
      decimals: DECIMALS,
      prices: PRICES,
    })
    const e = gql[0]!
    expect(e.__typename).toBe('GqlPoolSwapEventV3')
    expect(e.type).toBe('SWAP')
    const swapEvent = e as unknown as { tokenIn: { address: string; amount: string }; tokenOut: { address: string; amount: string } }
    expect(swapEvent.tokenIn.address).toBe('0x3f2327221dd4f0bae660172606d6b288a1cf8ad9')
    expect(swapEvent.tokenOut.amount).toBe('16.835074')
  })

  it('empty events → []', () => {
    expect(
      buildOnchainPoolEventsAsGqlEvents({ events: [], poolId: '0xabc', poolTokens: [], decimals: {}, prices: {} })
    ).toEqual([])
  })
})
