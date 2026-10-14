import { describe, expect, it, vi, beforeEach } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { OnchainPoolListItem } from './onchain-pool-discovery'

/**
 * Auditor round-2 FIX-3 (B/F-09): onchain-sourced pools NEVER fabricate zero
 * metrics. volume24h / fees24h / totalLiquidity are null (unavailable) at the
 * data source, and every rendering consumer displays '—' instead of $0.
 * Sorting treats null TVL as unavailable (sorts last) instead of crashing
 * or ranking on a fabricated 0.
 */

const h = vi.hoisted(() => ({
  logEntries: [] as { blockNumber: string; topics: string[] }[],
}))

vi.mock('viem', async importOriginal => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: vi.fn(async () => 47_000_000n),
      request: vi.fn(async ({ method, params }: { method: string; params: unknown[] }) => {
        if (method === 'eth_getLogs') {
          const range = params[0] as { fromBlock: string; toBlock: string }
          const from = parseInt(range.fromBlock, 16)
          const to = parseInt(range.toBlock, 16)
          // return only entries INSIDE the requested range (real RPC semantics)
          return h.logEntries.filter(
            e => parseInt(e.blockNumber, 16) >= from && parseInt(e.blockNumber, 16) <= to
          )
        }

        return []
      }),
      readContract: vi.fn(async () => 'test'),
    })),
  }
})

import { mapDiscoveredPoolToListItem, type DiscoveredPool } from './onchain-pool-discovery'
import { getBakedPools, scanDiscoveredPools } from './onchain-pool-fetch'
import { compareByTotalLiquidityDesc, poolMetricDisplay } from './pool-metrics'

const POW = '0x' + 'f'.repeat(64)
const ZERO_PAD = '0x' + '0'.repeat(24)

beforeEach(() => {
  h.logEntries = [
    {
      blockNumber: '0x' + (46_985_100).toString(16),
      topics: [POW, ZERO_PAD + 'a'.repeat(40), ZERO_PAD + 'b'.repeat(40)],
    },
  ]
})

describe('onchain pool metric availability (auditor round-2 FIX-3)', () => {
  it('baked registry pools: volume24h/fees24h/totalLiquidity are NULL (never fabricated zero)', () => {
    // Registry truth: Sepolia baked = 1 real pool; the Base mainnet baked
    // registry is EMPTY (honest zero — no pools baked yet). Either way,
    // every pool that DOES exist must carry null metrics.
    const sepolia = getBakedPools(GqlChainValues.BaseSepolia)
    expect(sepolia.length).toBeGreaterThan(0)
    const base = getBakedPools(GqlChainValues.Base)

    for (const pool of [...sepolia, ...base]) {
      expect(pool.dynamicData.volume24h, `${pool.chain} ${pool.address} volume24h`).toBeNull()
      expect(pool.dynamicData.fees24h, `${pool.chain} ${pool.address} fees24h`).toBeNull()

      expect(
        pool.dynamicData.totalLiquidity,
        `${pool.chain} ${pool.address} totalLiquidity`
      ).toBeNull()
    }
  })

  it('mapDiscoveredPoolToListItem: metrics are NULL', () => {
    const dp: DiscoveredPool = {
      address: '0x' + 'a'.repeat(40),
      factory: '0x277d7dde3c6762c31cfb438c9331376fe8887a7c',
      blockNumber: 46_985_100,
    }

    const item = mapDiscoveredPoolToListItem(dp, GqlChainValues.BaseSepolia)

    expect(item.dynamicData.volume24h).toBeNull()
    expect(item.dynamicData.fees24h).toBeNull()
    expect(item.dynamicData.totalLiquidity).toBeNull()
  })

  it('live scan items: metrics are NULL', async () => {
    const items = await scanDiscoveredPools(GqlChainValues.BaseSepolia)
    expect(items.length).toBe(1)

    expect(items[0]!.dynamicData.volume24h).toBeNull()
    expect(items[0]!.dynamicData.fees24h).toBeNull()
    expect(items[0]!.dynamicData.totalLiquidity).toBeNull()
  })
})

describe('poolMetricDisplay — unavailable renders em-dash, never $0', () => {
  const fmt = (v: string) => `$${v}`

  it('null → em-dash', () => {
    expect(poolMetricDisplay(null, fmt)).toBe('—')
  })

  it('undefined → em-dash', () => {
    expect(poolMetricDisplay(undefined, fmt)).toBe('—')
  })

  it('a real value formats through the formatter', () => {
    expect(poolMetricDisplay('123.45', fmt)).toBe('$123.45')
  })

  it('a genuine zero from an API-sourced pool still renders as a number', () => {
    // API pools may legitimately report '0' — the em-dash is reserved for
    // unavailable (null) metrics, never for real zeros.
    expect(poolMetricDisplay('0', fmt)).toBe('$0')
  })
})

describe('compareByTotalLiquidityDesc — null TVL sorts last, no crash', () => {
  const pool = (tvl: string | null) =>
    ({ dynamicData: { totalLiquidity: tvl } }) as OnchainPoolListItem

  it('numeric order preserved for real values', () => {
    expect(compareByTotalLiquidityDesc(pool('100'), pool('200'))).toBeGreaterThan(0)
    expect(compareByTotalLiquidityDesc(pool('200'), pool('100'))).toBeLessThan(0)
    expect(compareByTotalLiquidityDesc(pool('100'), pool('100'))).toBe(0)
  })

  it('null sorts last regardless of direction', () => {
    expect(compareByTotalLiquidityDesc(pool(null), pool('1'))).toBeGreaterThan(0)
    expect(compareByTotalLiquidityDesc(pool('1000000'), pool(null))).toBeLessThan(0)
  })

  it('two nulls tie (stable, no crash)', () => {
    expect(compareByTotalLiquidityDesc(pool(null), pool(null))).toBe(0)
  })
})
