import { describe, expect, it } from 'vitest'
import { mapDiscoveredPoolToListItem, type DiscoveredPool } from './onchain-pool-discovery'

/**
 * Pills law (browser-verified defect 2026-10-24): PoolListTokenPills render
 * token.symbol. Live-only pools (created after the last registry bake)
 * rendered ICON-ONLY pills because mapDiscoveredPoolToListItem collapsed
 * every token to { address }. A discovered pool whose scan enriched ERC20
 * metadata must pass symbol/name/decimals through to the list item.
 */

describe('token metadata passthrough (pills law)', () => {
  it('maps plain string tokens to address-only entries', () => {
    const dp = {
      address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      factory: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      blockNumber: 100,
      tokens: ['0x1111111111111111111111111111111111111111'],
    } as DiscoveredPool

    const item = mapDiscoveredPoolToListItem(dp)
    expect(item.poolTokens[0]).toEqual({ address: '0x1111111111111111111111111111111111111111' })
  })

  it('passes through enriched token objects with symbol/name/decimals', () => {
    const dp = {
      address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      factory: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      blockNumber: 100,
      tokens: [
        {
          address: '0x1111111111111111111111111111111111111111',
          symbol: 'NUT',
          name: 'Based Nut',
          decimals: 18,
        },
      ],
    } as unknown as DiscoveredPool

    const item = mapDiscoveredPoolToListItem(dp)

    expect(item.poolTokens[0]).toEqual({
      address: '0x1111111111111111111111111111111111111111',
      symbol: 'NUT',
      name: 'Based Nut',
      decimals: 18,
    })
  })
})
