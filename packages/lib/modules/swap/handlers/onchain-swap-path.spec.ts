import { describe, expect, it } from 'vitest'
import {
  buildOnchainSwapPaths,
  findOnchainPoolForPair,
  parseGivenAmountRaw,
} from './onchain-swap-path'
import type { OnchainPoolListItem } from '../../pool/onchain-pool-discovery'

// Rootstock law: BASESEP swaps build paths LOCALLY from onchain-discovered
// pools — never the remote API SOR. Amounts stay exact via onchain query()
// in BaseDefaultSwapHandler.runSimulation (inherited, unchanged).
describe('onchain swap path building', () => {
  const mockPool: OnchainPoolListItem = {
    id: '0xBeC8dE18d5Fe6277670D989d12aEffed8000F1d6',
    address: '0xBeC8dE18d5Fe6277670D989d12aEffed8000F1d6',
    chain: 'BASESEP',
    type: 'WEIGHTED',
    protocolVersion: 3,
    symbol: 'TEST',
    name: 'Mock Weighted Pool',
    factory: '0x277d7dde3c6762c31cfb438c9331376fe8887a7c',
    createTime: 46985225,
    poolTokens: [
      { address: '0x4200000000000000000000000000000000000006' }, // WETH
      { address: '0x8c6487b86a73554431d514371184916b0b61b876' }, // BAL-mock
    ],
    dynamicData: { totalLiquidity: '0', volume24h: '0', fees24h: '0', aprItems: [] },
  }

  it('finds the pool containing a token pair', () => {
    const hit = findOnchainPoolForPair(
      [mockPool],
      '0x4200000000000000000000000000000000000006',
      '0x8c6487b86a73554431d514371184916b0b61b876'
    )

    expect(hit?.address).toBe(mockPool.address)

    // pair order-insensitive
    const reversed = findOnchainPoolForPair(
      [mockPool],
      '0x8c6487b86a73554431d514371184916b0b61b876',
      '0x4200000000000000000000000000000000000006'
    )

    expect(reversed?.address).toBe(mockPool.address)
  })

  it('native ETH matches a WETH pool (equivalence, live bug 2026-09-22)', () => {
    const hit = findOnchainPoolForPair(
      [mockPool],
      '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // native ETH
      '0x8c6487b86a73554431d514371184916b0b61b876' // BAL
    )

    expect(hit?.address).toBe(mockPool.address)
  })

  it('returns undefined when no pool holds the pair', () => {
    const miss = findOnchainPoolForPair(
      [mockPool],
      '0x4200000000000000000000000000000000000006',
      '0xdead'
    )

    expect(miss).toBeUndefined()
  })

  it('builds a single-pool Path with correct shape', () => {
    const tokenIn = { address: '0x4200000000000000000000000000000000000006', decimals: 18 }
    const tokenOut = { address: '0x8c6487b86a73554431d514371184916b0b61b876', decimals: 18 }

    const paths = buildOnchainSwapPaths({
      pool: mockPool,
      tokenIn,
      tokenOut,
      specifiedAmountRaw: 1000000000000000000n,
      swapType: 'EXACT_IN',
    })

    expect(paths.length).toBe(1)
    const p = paths[0]
    expect(p).toBeDefined()
    expect(p!.pools).toEqual([mockPool.address])
    expect(p!.protocolVersion).toBe(3)
    expect(p!.inputAmountRaw).toBe(1000000000000000000n)
    expect(p!.tokens.length).toBe(2)
    expect(p!.isBuffer).toBeUndefined()
  })

  it('reverses token order when pair is reversed (EXACT_IN path token order = in→out)', () => {
    const tokenIn = { address: '0x8c6487b86a73554431d514371184916b0b61b876', decimals: 18 }
    const tokenOut = { address: '0x4200000000000000000000000000000000000006', decimals: 18 }

    const paths = buildOnchainSwapPaths({
      pool: mockPool,
      tokenIn,
      tokenOut,
      specifiedAmountRaw: 5n,
      swapType: 'EXACT_IN',
    })

    const p2 = paths[0]
    expect(p2).toBeDefined()
    expect(p2!.tokens[0]!.address).toBe(tokenIn.address)
    expect(p2!.tokens[1]!.address).toBe(tokenOut.address)
  })
})

// ─── Auditor F-01 (2026-10-09): specified-token decimal law ───
// The raw amount must be scaled by the decimals of the token whose amount
// the user SPECIFIED: EXACT_IN → input token decimals; EXACT_OUT → output
// token decimals. SDK law (verified in @balancer/sdk 6.2.0 dist): GivenIn
// consumes path.inputAmount (inputAmountRaw), GivenOut consumes
// path.outputAmount (outputAmountRaw) — query() reads the matching side.
describe('parseGivenAmountRaw — specified-token decimal scaling (auditor F-01)', () => {
  it('EXACT_IN uses the INPUT token decimals (1 USDC 6dec → 1e6, not 1e18)', () => {
    // 1 USDC (6 decimals) → WETH (18 decimals): raw input must be 1_000_000
    expect(parseGivenAmountRaw('1', 'EXACT_IN', 6, 18)).toBe(1_000_000n)
  })

  it('EXACT_IN 18/18 stays exact', () => {
    expect(parseGivenAmountRaw('1', 'EXACT_IN', 18, 18)).toBe(1_000_000_000_000_000_000n)
  })

  it('EXACT_IN 8dec token (wNUT-style) scales by 8', () => {
    expect(parseGivenAmountRaw('2.5', 'EXACT_IN', 8, 18)).toBe(250_000_000n)
  })

  it('EXACT_OUT uses the OUTPUT token decimals (1 WETH out → 1e18)', () => {
    // exact-out: user specifies how much WETH they want OUT → 18-dec scaling
    expect(parseGivenAmountRaw('1', 'EXACT_OUT', 6, 18)).toBe(1_000_000_000_000_000_000n)
  })

  it('EXACT_OUT 6dec output token scales by 6', () => {
    expect(parseGivenAmountRaw('10.5', 'EXACT_OUT', 18, 6)).toBe(10_500_000n)
  })

  it('fractional beyond decimals truncates (no rounding up user funds)', () => {
    // 1.000001 USDC = 1.000001e6 → 1_000_001 (truncation, never inflate)
    expect(parseGivenAmountRaw('1.000001', 'EXACT_IN', 6, 18)).toBe(1_000_001n)
  })

  it('zero and empty are safe', () => {
    expect(parseGivenAmountRaw('0', 'EXACT_IN', 6, 18)).toBe(0n)
    expect(parseGivenAmountRaw('', 'EXACT_IN', 6, 18)).toBe(0n)
  })

  it('malformed input falls back to 0 (never NaN/throw)', () => {
    expect(parseGivenAmountRaw('abc', 'EXACT_IN', 6, 18)).toBe(0n)
    expect(parseGivenAmountRaw('1.2.3', 'EXACT_IN', 6, 18)).toBe(0n)
  })
})

describe('buildOnchainSwapPaths — exact-out semantics (auditor F-01)', () => {
  const mockPool: OnchainPoolListItem = {
    id: '0xBeC8dE18d5Fe6277670D989d12aEffed8000F1d6',
    address: '0xBeC8dE18d5Fe6277670D989d12aEffed8000F1d6',
    chain: 'BASESEP',
    type: 'WEIGHTED',
    protocolVersion: 3,
    symbol: 'TEST',
    name: 'Mock Weighted Pool',
    factory: '0x277d7dde3c6762c31cfb438c9331376fe8887a7c',
    createTime: 46985225,
    poolTokens: [],
    dynamicData: { totalLiquidity: '0', volume24h: '0', fees24h: '0', aprItems: [] },
  }

  const tokenIn = { address: '0x8c6487b86a73554431d514371184916b0b61b876', decimals: 6 }
  const tokenOut = { address: '0x4200000000000000000000000000000000000006', decimals: 18 }

  it('EXACT_OUT places the specified amount in outputAmountRaw', () => {
    const paths = buildOnchainSwapPaths({
      pool: mockPool,
      tokenIn,
      tokenOut,
      specifiedAmountRaw: 1_000_000_000_000_000_000n, // user wants 1 WETH OUT
      swapType: 'EXACT_OUT',
    })

    expect(paths[0]!.outputAmountRaw).toBe(1_000_000_000_000_000_000n)
  })
})
