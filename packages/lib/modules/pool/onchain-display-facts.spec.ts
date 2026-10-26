import { describe, expect, it } from 'vitest'
import {
  ONCHAIN_TAG,
  derivePoolDisplayFacts,
  mapDiscoveredPoolToListItem,
} from './onchain-pool-discovery'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { aggregatePoolListMetrics } from './pool-metrics'
import { ROOTSTOCK_HOOKS, getRootstockHookReviewData } from '@repo/lib/modules/hooks/rootstockHooks'
import { PoolDisplayType } from './pool.types'

/**
 * Display facts law (2026-10-26): pools render their onchain truth —
 * BOOSTED for WITH_RATE tokens, external hook address for real hook pools.
 * Self-hooked pools carry no hook and no tag (upstream parity).
 * Never guessed.
 */

const POOL = '0x9e75fc8ebcece644ed9e6229bae8cb1368b61349'
const ZERO = '0x0000000000000000000000000000000000000000'

describe('derivePoolDisplayFacts', () => {
  it('plain weighted pool: no hook, no tags', () => {
    const facts = derivePoolDisplayFacts({ pool: POOL, hooksContract: ZERO, tokenTypes: [0, 0] })
    expect(facts.hook).toBeNull()
    expect(facts.tags).toEqual([])
  })

  it('WITH_RATE token → BOOSTED tag (wstETH/sFRAX/alUSDb class)', () => {
    const facts = derivePoolDisplayFacts({ pool: POOL, hooksContract: ZERO, tokenTypes: [0, 1] })
    expect(facts.tags).toEqual([ONCHAIN_TAG.Boosted])
  })

  it('self-hooked pool → no hook, no tags (upstream parity — PERMISSIONED removed)', () => {
    const facts = derivePoolDisplayFacts({ pool: POOL, hooksContract: POOL, tokenTypes: [0, 0] })
    expect(facts.hook).toBeNull()
    expect(facts.tags).toEqual([])
  })

  it('external hook → hook address + no permissioned tag (surge class)', () => {
    const SURGE = '0x2bdde9a6e0f9ad3f7349e09617cf7feb655c5981'
    const facts = derivePoolDisplayFacts({ pool: POOL, hooksContract: SURGE, tokenTypes: [0, 0] })
    expect(facts.hook).toBe(SURGE)
    expect(facts.tags).toEqual([])
  })

  it('self-hooked + boosted - BOOSTED only', () => {
    const facts = derivePoolDisplayFacts({ pool: POOL, hooksContract: POOL, tokenTypes: [2, 0] })
    expect(facts.tags).toEqual([ONCHAIN_TAG.Boosted])
  })
})

describe('mapDiscoveredPoolToListItem wraps facts for the UI', () => {
  it('external hook string becomes { address } object (useHook reads .address)', () => {
    const SURGE = '0x2bdde9a6e0f9ad3f7349e09617cf7feb655c5981'

    const item = mapDiscoveredPoolToListItem(
      { address: POOL, factory: '0xf', blockNumber: 1, hook: SURGE, tags: [ONCHAIN_TAG.Boosted] },
      GqlChainValues.Base
    )

    // v2: OUR surge deployment also carries evidence-backed reviewData
    expect(item.hook).toMatchObject({ address: SURGE })
    expect(item.hook?.reviewData?.summary).toBe('safe')
    expect(item.tags).toEqual([ONCHAIN_TAG.Boosted])
  })

  it('no hook → hook null, tags passthrough', () => {
    const item = mapDiscoveredPoolToListItem(
      { address: POOL, factory: '0xf', blockNumber: 1, hook: null, tags: [] },
      GqlChainValues.Base
    )

    expect(item.hook).toBeNull()
    expect(item.tags).toEqual([])
  })
})

describe('ROOTSTOCK hook metadata (surge/MEV never unmatched)', () => {
  it('carries our Base mainnet + Sepolia deployments', () => {
    const surge = ROOTSTOCK_HOOKS.find(h => h.id === 'rootstock-stable-surge')
    expect(surge).toBeDefined()
    expect(surge!.addresses['8453']).toContain('0x2bdde9a6e0f9ad3f7349e09617cf7feb655c5981')
    expect(surge!.addresses['84532']).toContain('0x581e1de0c136134af479d09619b5f950420a427d')

    const mev = ROOTSTOCK_HOOKS.find(h => h.id === 'rootstock-mev-capture')
    expect(mev!.addresses['8453']).toContain('0xfe807044d0329bd96aea42a78f091c2db1069f42')
  })
})

describe('PoolDisplayType.Tickers (3-way toggle)', () => {
  it('exists as a third display option', () => {
    expect(PoolDisplayType.Tickers).toBe('tickers')
    expect(Object.values(PoolDisplayType).length).toBe(3)
  })
})

describe('aggregatePoolListMetrics (stats band)', () => {
  it('sums real values, skips nulls, all-null stays null', () => {
    const r = aggregatePoolListMetrics([
      { dynamicData: { totalLiquidity: '100', volume24h: '5', fees24h: '1' } },
      { dynamicData: { totalLiquidity: '50', volume24h: null, fees24h: null } },
      { dynamicData: null },
    ])

    expect(r.totalLiquidity).toBe(150)
    expect(r.volume24h).toBe(5)
    expect(r.fees24h).toBe(1)
    expect(r.poolCount).toBe(3)
  })

  it('fully-null metric stays null — never a fabricated 0', () => {
    const r = aggregatePoolListMetrics([
      { dynamicData: { totalLiquidity: null, volume24h: null, fees24h: null } },
    ])

    expect(r.totalLiquidity).toBeNull()
    expect(r.volume24h).toBeNull()
    expect(r.fees24h).toBeNull()
  })

  it('genuine zero contributes as a real value', () => {
    const r = aggregatePoolListMetrics([
      { dynamicData: { totalLiquidity: '100', volume24h: '0', fees24h: '0' } },
    ])

    expect(r.volume24h).toBe(0)
    expect(r.fees24h).toBe(0)
  })
})

describe('ROOTSTOCK hook review data (safety gate honesty)', () => {
  it('returns safe review data for OUR surge + MEV addresses (case-insensitive)', () => {
    const surgeLower = '0x2bdde9a6e0f9ad3f7349e09617cf7feb655c5981'
    const surgeChecksum = '0x2Bdde9A6e0f9ad3f7349E09617cf7fEB655c5981'
    const mevLower = '0xfe807044d0329bd96aea42a78f091c2db1069f42'

    for (const addr of [surgeLower, surgeChecksum, mevLower]) {
      const rd = getRootstockHookReviewData(addr)
      expect(rd).not.toBeNull()
      expect(rd!.summary).toBe('safe')
      expect(rd!.warnings).toEqual([])
    }
  })

  it('returns null for addresses that are NOT our deployments - never fabricates a review', () => {
    expect(getRootstockHookReviewData('0x1234567890abcdef1234567890abcdef12345678')).toBeNull()
    // upstream Balancer surge deployment on Base - not ours
    expect(getRootstockHookReviewData('0xb2007b8b7e0260042517f635cfd8e6dd2dd7f007')).toBeNull()
  })

  it('mapDiscoveredPoolToListItem attaches reviewData to external-hook pools', () => {
    const SURGE = '0x2Bdde9A6e0f9ad3f7349E09617cf7fEB655c5981'

    const item = mapDiscoveredPoolToListItem(
      { address: POOL, factory: '0xf', blockNumber: 1, hook: SURGE, tags: [] },
      GqlChainValues.Base
    )

    expect(item.hook).toMatchObject({ address: SURGE })
    expect((item.hook as { reviewData?: { summary: string } }).reviewData?.summary).toBe('safe')
  })
})
