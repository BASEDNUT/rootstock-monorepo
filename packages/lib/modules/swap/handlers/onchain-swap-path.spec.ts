import { describe, expect, it } from 'vitest'
import { buildOnchainSwapPaths, findOnchainPoolForPair } from './onchain-swap-path'
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
      inputAmountRaw: 1000000000000000000n,
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
      inputAmountRaw: 5n,
      swapType: 'EXACT_IN',
    })

    const p2 = paths[0]
    expect(p2).toBeDefined()
    expect(p2!.tokens[0]!.address).toBe(tokenIn.address)
    expect(p2!.tokens[1]!.address).toBe(tokenOut.address)
  })
})
