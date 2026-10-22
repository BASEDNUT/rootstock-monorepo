import { describe, expect, it } from 'vitest'
import { decodePoolEventLog } from './onchain-pool-events'

/*
 * B2c (live-caught 2026-10-21): pool-detail '0 transactions yet' — the
 * remote API never knows onchain-only pools. Activity comes from the
 * chain: Vault LiquidityAdded/LiquidityRemoved/Swap events decoded with
 * per-token decimals.
 *
 * Golden fixtures: REAL logs from our Base mainnet Vault
 * (block 52913373 pNUT initialize; block 52709325 pipsUSDC swap).
 */

const GOLDEN_LIQUIDITY_ADDED = {
  "blockNumber": "0x32764dd",
  "transactionHash": "0x013c7fbd1eb081318430904595628c9248b87eff26b0b6b43e41874588b0ae61",
  "topics": [
    "0xa26a52d8d53702bba7f137907b8e1f99ff87f6d450144270ca25e72481cca871",
    "0x000000000000000000000000f64ae6f64be7c223092c399dfd2e388db5e16080",
    "0x000000000000000000000000135b208ac2480b0d876944416de16e7a3b9a1f65",
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  ],
  "data": "0x00000000000000000000000000000000000000000000000000bf70d70da063590000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000031b99af09d6246000000000000000000000000000000000000000000000000000000b3ac4eee80000000000000000000000000000000000000000000000000000526c46eeca000000000000000000000000000000000000000000000000000000000000000b82300000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
}
const GOLDEN_SWAP = {
  "blockNumber": "0x32447cd",
  "transactionHash": "0x5e9459d130b20356b34e246bb95a6aa81b0d8a4b3cfe39c22a4d796f4005fd48",
  "topics": [
    "0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db",
    "0x000000000000000000000000f8e5ca8397ed7fa5c17ebd73c3b42660abf62c53",
    "0x0000000000000000000000003f2327221dd4f0bae660172606d6b288a1cf8ad9",
    "0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913"
  ],
  "data": "0x000000000000000000000000000000000000000000013f5251039adbfc8cc51b000000000000000000000000000000000000000000000000000000000100e202000000000000000000000000000000000000000000000000002386f26fc100000000000000000000000000000000000000000000000003317691f4bfa3ce352c"
}

const DECIMALS = {
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 18, // cbETH
  '0xac130701aa31c284c36609e2489f150f419ad7ad': 9, // SNUT
  '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3': 18, // wNUT
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': 8, // cbBTC
  '0x3f2327221dd4f0bae660172606d6b288a1cf8ad9': 18, // PIPS
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 6, // USDC
}

describe('decodePoolEventLog — LiquidityAdded (golden pNUT initialize)', () => {
  it('decodes type/userAddress/kind/amounts with per-token decimals', () => {
    const e = decodePoolEventLog(GOLDEN_LIQUIDITY_ADDED, {
      blockTimestamp: 1792616093,
      decimals: DECIMALS,
      poolTokens: [
        '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22',
        '0xac130701aa31c284c36609e2489f150f419ad7ad',
        '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3',
        '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
      ],
    })!

    expect(e).not.toBeNull()
    expect(e.type).toBe('ADD')
    if (e.type === 'ADD' || e.type === 'REMOVE') {
      expect(e.userAddress).toBe('0x135b208ac2480b0d876944416de16e7a3b9a1f65')
      expect(e.kind).toBe(1)
      expect(e.tokens).toHaveLength(4)
      const snut = e.tokens.find(t => t.address === '0xac130701aa31c284c36609e2489f150f419ad7ad')
      expect(snut?.amount).toBe('771.69')
      const cbbtc = e.tokens.find(t => t.address === '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf')
      expect(cbbtc?.amount).toBe('0.00047139')
    } else {
      throw new Error('expected ADD event')
    }
  })

  it('carries timestamp/tx/pool/block', () => {
    const e = decodePoolEventLog(GOLDEN_LIQUIDITY_ADDED, {
      blockTimestamp: 1792616093,
      decimals: DECIMALS,
      poolTokens: [],
    })!
    expect(e).not.toBeNull()
    expect(e.timestamp).toBe(1792616093)
    expect(e.tx).toBe(GOLDEN_LIQUIDITY_ADDED.transactionHash)
    expect(e.pool).toBe('0xf64ae6f64be7c223092c399dfd2e388db5e16080')
    expect(e.block).toBe(52913373)
  })
})

describe('decodePoolEventLog — Swap (golden pipsUSDC)', () => {
  it('decodes tokenIn/tokenOut with decimals', () => {
    const e = decodePoolEventLog(GOLDEN_SWAP, {
      blockTimestamp: 1792207997,
      decimals: DECIMALS,
      poolTokens: [
        '0x3f2327221dd4f0bae660172606d6b288a1cf8ad9',
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      ],
    })!
    expect(e).not.toBeNull()
    if (e.type === 'SWAP') {
      expect(e.tokenIn?.address).toBe('0x3f2327221dd4f0bae660172606d6b288a1cf8ad9')
      // truncation (understated-but-real), never rounding — the app law
      expect(e.tokenIn?.amount).toBe('1507953.378729272')
      expect(e.tokenOut?.address).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
      expect(e.tokenOut?.amount).toBe('16.835074')
    } else {
      throw new Error('expected SWAP event')
    }
  })
})

describe('decodePoolEventLog — unknown topic → null (never guess)', () => {
  it('returns null for non-activity topics', () => {
    const garbage = { ...GOLDEN_LIQUIDITY_ADDED, topics: ['0xdeadbeef', ...GOLDEN_LIQUIDITY_ADDED.topics.slice(1)] }
    expect(decodePoolEventLog(garbage, { blockTimestamp: 1, decimals: {}, poolTokens: [] })).toBeNull()
  })

  it('returns null for malformed logs (no throw)', () => {
    expect(decodePoolEventLog(null as never, { blockTimestamp: 1, decimals: {}, poolTokens: [] })).toBeNull()
    expect(decodePoolEventLog({ topics: [] } as never, { blockTimestamp: 1, decimals: {}, poolTokens: [] })).toBeNull()
  })
})
