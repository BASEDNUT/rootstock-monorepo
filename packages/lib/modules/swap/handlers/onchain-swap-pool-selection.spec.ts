import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { OnchainPoolListItem } from '../../pool/onchain-pool-discovery'
import type { SimulateSwapInputs } from '../swap.types'

/**
 * Auditor round-2 FIX-1 (A/F-04): pool-specific swaps must execute the
 * REQUESTED pool — never a silent fallback to another pool. General swaps
 * quote-compare candidates (staticcall Swap.query) capped at 5 and pick the
 * best quote. Handler-level battery with a mocked SDK Swap whose query()
 * resolves per-pool amounts from a fixture map.
 */

const h = vi.hoisted(() => ({
  /** pool address (lowercase) → quoted amount (out for GivenIn / in for GivenOut) */
  quotes: new Map<string, bigint>(),
  /** every pool the mocked Swap.query was asked to quote, in order */
  quoted: [] as string[],
  /** fetchDiscoveredPools fixture (set per test) */
  pools: [] as OnchainPoolListItem[],
  /** token addresses whose mocked decimals() read REVERTS (fail-closed law) */
  throwDecimalsFor: new Set<string>(),
}))

vi.mock('viem', async importOriginal => {
  // Only createPublicClient is intercepted (token-decimals reads). `http`
  // must stay REAL — ChainConfig's transitive fork.helpers calls viem
  // createTestClient({ transport: http(...) }) and a stubbed transport
  // breaks it (parameters.transport is not a function).
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      readContract: vi.fn(
        async ({ functionName, address }: { functionName: string; address: string }) => {
          if (functionName === 'decimals') {
            if (h.throwDecimalsFor.has(address.toLowerCase())) {
              throw new Error(`mock decimals() revert for ${address}`)
            }

            return 18
          }

          return '0x'
        }
      ),
    })),
  }
})

vi.mock('@balancer/sdk', async importOriginal => {
  // Partial mock: only Swap is intercepted (per-pool query fixtures). All
  // other exports (ChainId etc. — required by transitive app.config imports)
  // stay real.
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    Swap: vi
      .fn()
      .mockImplementation(
        ({ paths, swapKind }: { paths: { pools: string[] }[]; swapKind: string }) => ({
          query: vi.fn(async () => {
            const pool = (paths[0]?.pools[0] || '').toLowerCase()
            h.quoted.push(pool)
            const amount = h.quotes.get(pool)

            if (amount === undefined) {
              throw new Error(`mock Swap.query: no quote fixture for pool ${pool}`)
            }

            return {
              swapKind,
              expectedAmountOut: { amount, token: { decimals: 18 } },
              expectedAmountIn: { amount, token: { decimals: 18 } },
              to: '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759',
            }
          }),
        })
      ),
  }
})

vi.mock('../../pool/onchain-pool-fetch', () => ({
  fetchDiscoveredPools: vi.fn(async () => h.pools),
}))

import { OnchainSwapHandler } from './OnchainSwap.handler'

const WETH = '0x4200000000000000000000000000000000000006'
const BAL = '0x8c6487b86A73554431d514371184916B0B61B876'

function makePool(address: string, name: string): OnchainPoolListItem {
  return {
    id: address,
    address,
    chain: 'BASESEP',
    type: 'WEIGHTED',
    protocolVersion: 3,
    symbol: name,
    name,
    factory: '0x277d7dde3c6762c31cfb438c9331376fe8887a7c',
    createTime: 46_985_000,
    poolTokens: [{ address: WETH }, { address: BAL }],
    dynamicData: { totalLiquidity: '0', volume24h: '0', fees24h: '0', aprItems: [] },
  }
}

const POOL_A = makePool('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'Pool A')
const POOL_B = makePool('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'Pool B')

function baseInputs(overrides: Partial<SimulateSwapInputs> = {}): SimulateSwapInputs {
  return {
    chain: GqlChainValues.BaseSepolia,
    tokenIn: WETH,
    tokenOut: BAL,
    swapType: 'EXACT_IN',
    swapAmount: '0.001',
    ...overrides,
  }
}

beforeEach(() => {
  h.quotes.clear()
  h.quoted.length = 0
  h.throwDecimalsFor.clear()
  h.pools = [POOL_A, POOL_B]
})

describe('OnchainSwapHandler pool selection (auditor round-2 FIX-1)', () => {
  it('pool-specific: executes the REQUESTED pool even when a foreign pool quotes better', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 999_000_000_000_000_000n) // foreign, better
    h.quotes.set(POOL_B.address.toLowerCase(), 5_000_000_000_000_000n) // requested, worse

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs({ poolIds: [POOL_B.address] }))

    expect(result.paths?.[0]?.pools?.[0]).toBe(POOL_B.address)
    // the foreign pool is never quoted AND never executed
    expect(h.quoted).toEqual([POOL_B.address.toLowerCase()])
  })

  it('pool-specific: accepts full Balancer pool IDs (address + suffix grammar)', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 1n)
    // Balancer pool id = pool address (20 bytes) + 12-byte suffix
    const fullPoolId = `${POOL_A.address}000000000000000000000000000000000002`

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs({ poolIds: [fullPoolId] }))

    expect(result.paths?.[0]?.pools?.[0]).toBe(POOL_A.address)
  })

  it('pool-specific: FAILS EXPLICITLY when the requested pool is not among the candidates', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 1n)
    h.quotes.set(POOL_B.address.toLowerCase(), 1n)
    const foreign = '0xcccccccccccccccccccccccccccccccccccccccc'

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)

    await expect(handler.simulate(baseInputs({ poolIds: [foreign] }))).rejects.toThrow(
      /0xcccccccccccccccccccccccccccccccccccccccc/
    )

    // no silent fallback: nothing was quoted or executed
    expect(h.quoted).toEqual([])
  })

  it('pool-specific: FAILS EXPLICITLY when the requested pool exists but does not hold the pair', async () => {
    // pool B holds WETH/USDC — not the requested WETH/BAL pair
    const poolOtherPair: OnchainPoolListItem = {
      ...POOL_B,
      poolTokens: [
        { address: WETH },
        { address: '0x833589fcd5edb6e30c95f8905aea2fbe2c1b7a7b' }, // USDC
      ],
    }

    h.pools = [POOL_A, poolOtherPair]
    h.quotes.set(POOL_A.address.toLowerCase(), 1n)

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)

    await expect(
      handler.simulate(baseInputs({ poolIds: [poolOtherPair.address] }))
    ).rejects.toThrow(/not available/i)
  })

  it('general swap (no poolIds): picks the BEST quote for EXACT_IN (max out)', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 10_000_000_000_000_000n)
    h.quotes.set(POOL_B.address.toLowerCase(), 99_000_000_000_000_000n)

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs())

    expect(result.paths?.[0]?.pools?.[0]).toBe(POOL_B.address)
  })

  it('general swap (no poolIds): picks the CHEAPEST quote for EXACT_OUT (min in)', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 100_000_000_000_000_000n)
    h.quotes.set(POOL_B.address.toLowerCase(), 50_000_000_000_000_000n)

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)

    const result = await handler.simulate(
      baseInputs({ swapType: 'EXACT_OUT', swapAmount: '0.001' })
    )

    expect(result.paths?.[0]?.pools?.[0]).toBe(POOL_B.address)
  })

  it('general swap with liquidity data: quote cap is 5, ranked by liquidity (data-driven budget)', async () => {
    // F-03 (2026-10-13): the cap now applies to LIQUIDITY-RANKED candidates
    // (blind pools are never excluded - see the blind-path test below).
    const candidates = Array.from({ length: 6 }, (_, i) => ({
      ...makePool(`0x${(0xd0000000 + i).toString(16).padStart(40, '0')}`, `Pool ${i}`),
      dynamicData: {
        totalLiquidity: String((i + 1) * 100),
        volume24h: null,
        fees24h: null,
        aprItems: [],
      },
    }))

    h.pools = candidates

    // quote fixtures for the TOP FIVE by liquidity (600..200) - the
    // lowest-liquidity pool (index 0, liq 100) has no fixture: being
    // asked to quote makes the mock throw, failing the test.
    for (let i = 1; i <= 5; i++) {
      h.quotes.set(candidates[i]!.address.toLowerCase(), BigInt(i))
    }

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs())

    // best of the five quoted = index 5 (amount 5, highest liquidity)
    expect(result.paths?.[0]?.pools?.[0]).toBe(candidates[5]!.address)
    // the lowest-liquidity pool is never ASKED to quote
    expect(h.quoted).not.toContain(candidates[0]!.address.toLowerCase())
    expect(new Set(h.quoted).size).toBe(5)
  })

  it('single candidate: executes it without a quote-comparison round', async () => {
    h.pools = [POOL_A]
    h.quotes.set(POOL_A.address.toLowerCase(), 7n)

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs())

    expect(result.paths?.[0]?.pools?.[0]).toBe(POOL_A.address)
    // one query only — the final simulation; no comparison round
    expect(h.quoted).toEqual([POOL_A.address.toLowerCase()])
  })

  it('fail-closed decimals: a token whose decimals() read reverts aborts the swap - never a guessed 18', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 5n)
    h.quotes.set(POOL_B.address.toLowerCase(), 6n)
    h.throwDecimalsFor.add(BAL.toLowerCase()) // tokenOut decimals read reverts

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)

    await expect(handler.simulate(baseInputs())).rejects.toThrow(/decimals unreadable/i)
    // the abort happens BEFORE pool selection - nothing was quoted
    expect(h.quoted).toEqual([])
  })

  it('one failed quote does not kill the comparison - the surviving pool still wins', async () => {
    h.quotes.set(POOL_A.address.toLowerCase(), 5_000_000_000_000_000n) // quotes fine
    // POOL_B has NO quote fixture - its Swap.query rejects

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs())

    expect(result.paths?.[0]?.pools?.[0]).toBe(POOL_A.address)
    expect(h.quoted).toContain(POOL_B.address.toLowerCase()) // it was tried and excluded
  })

  it('all candidates failing to quote is an explicit error - never a silent empty selection', async () => {
    // no fixtures at all - every candidate Swap.query rejects

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)

    await expect(handler.simulate(baseInputs())).rejects.toThrow(
      /all candidate pools failed to quote/i
    )
  })

  it('candidate ranking is deterministic: liquidity DESC, then newest, then address ASC', async () => {
    const mk = (addr: string, liq: string, createTime: number) => ({
      ...makePool(addr, `Pool ${addr.slice(0, 6)}`),
      createTime,
      dynamicData: { totalLiquidity: liq, volume24h: null, fees24h: null, aprItems: [] },
    })

    const six = [
      mk('0x6666666666666666666666666666666666666666', '50', 6), // lowest liquidity — FIRST in scan order
      mk('0x1111111111111111111111111111111111111111', '100', 1),
      mk('0x2222222222222222222222222222222222222222', '500', 2),
      mk('0x3333333333333333333333333333333333333333', '300', 3),
      mk('0x4444444444444444444444444444444444444444', '200', 4),
      mk('0x5555555555555555555555555555555555555555', '400', 5),
    ]

    h.pools = six

    // quote fixtures for the top five BY LIQUIDITY (the ranked comparison
    // set: 500, 400, 300, 200, 100) — the low-liquidity pool has no fixture,
    // so being asked to quote at all makes the mock throw and surfaces here
    for (const liq of ['500', '400', '300', '200', '100']) {
      const pool = six.find(p => p.dynamicData.totalLiquidity === liq)!
      h.quotes.set(pool.address.toLowerCase(), BigInt(liq))
    }

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs())

    // the lowest-liquidity pool (scan index 0) is never ASKED to quote —
    // RED-able: the old scan-order slice(0, 5) included it
    expect(h.quoted).not.toContain(six[0]!.address.toLowerCase())
    expect(result.paths?.[0]?.pools?.[0]).toBeDefined()
  })

  it('no pool for the pair: honest no-pool error (existing law unchanged)', async () => {
    h.pools = []

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    await expect(handler.simulate(baseInputs())).rejects.toThrow(/no.*pool found/i)
  })

  it('F-03 blind path: no liquidity data - every candidate is quoted (best price never excluded by recency)', async () => {
    // 6 pools, ALL liquidity-blind (null) - the discovery reality today.
    // The best executable price sits on the OLDEST pool: a recency-
    // ranked cap would exclude it before quoting.
    const candidates = Array.from({ length: 6 }, (_, i) => ({
      ...makePool(`0x${(0xe0000000 + i).toString(16).padStart(40, '0')}`, `Pool ${i}`),
      createTime: 40_000_000 + i, // index 0 = OLDEST
      dynamicData: { totalLiquidity: null, volume24h: null, fees24h: null, aprItems: [] },
    }))

    h.pools = candidates

    // the OLDEST pool (index 0) carries the best price (amount 10)
    for (let i = 0; i < 6; i++) {
      h.quotes.set(candidates[i]!.address.toLowerCase(), BigInt(10 - i))
    }

    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    const result = await handler.simulate(baseInputs())

    // ALL SIX quoted - the oldest was never excluded by the cap
    expect(new Set(h.quoted).size).toBe(6)
    expect(h.quoted).toContain(candidates[0]!.address.toLowerCase())
    // best quote wins: the oldest pool
    expect(result.paths?.[0]?.pools?.[0]).toBe(candidates[0]!.address)
  })
})
