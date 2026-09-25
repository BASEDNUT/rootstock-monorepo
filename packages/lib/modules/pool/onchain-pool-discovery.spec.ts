import { describe, expect, it } from 'vitest'
import {
  FACTORY_TO_POOL_TYPE,
  POOL_REGISTERED_TOPIC0,
  getOnchainDiscoveryRpcUrl,
  mapDiscoveredPoolToListItem,
  type DiscoveredPool,
} from './onchain-pool-discovery'

// Rootstock law: Base Sepolia pool discovery is fully onchain — Vault events
// + direct reads. NEVER the remote API. sepolia.base.org only (publicnode's
// historical log index is broken — verified live 2026-09-22).
describe('onchain pool discovery', () => {
  it('maps all 8 factories to pool types', () => {
    expect(FACTORY_TO_POOL_TYPE.size).toBe(8)
    expect(FACTORY_TO_POOL_TYPE.get('0x277d7dde3c6762c31cfb438c9331376fe8887a7c')).toBe('WEIGHTED')
    expect(FACTORY_TO_POOL_TYPE.get('0x24ab9fba48e54b05c24a02122c4c40fd2018ba10')).toBe('STABLE')
    expect(FACTORY_TO_POOL_TYPE.get('0x6cd1150ccc00e0d00cd3f671a8bdf00d38f5be6e')).toBe('STABLE')
    expect(FACTORY_TO_POOL_TYPE.get('0x928e433f50fa579c9be5f7e1273f1db46d630ee1')).toBe('RECLAMM')

    expect(FACTORY_TO_POOL_TYPE.get('0xdfdddd87dc49756dd93598123879ae3d67b531a3')).toBe(
      'LIQUIDITY_BOOTSTRAPPING'
    )
  })

  it('uses the correct PoolRegistered topic0', () => {
    // Verified live: keccak of PoolRegistered(address,address,(...),uint256,uint32,(...),(...),(...))
    expect(POOL_REGISTERED_TOPIC0).toBe(
      '0xbc1561eeab9f40962e2fb827a7ff9c7cdb47a9d7c84caeefa4ed90e043842dad'
    )
  })

  it('uses sepolia.base.org for discovery (not publicnode)', () => {
    expect(getOnchainDiscoveryRpcUrl()).toBe('https://sepolia.base.org')
    expect(getOnchainDiscoveryRpcUrl()).not.toContain('publicnode')
  })

  it('maps a discovered pool to list-item shape', () => {
    const dp: DiscoveredPool = {
      address: '0xBeC8dE18d5Fe6277670D989d12aEffed8000F1d6',
      factory: '0x277d7dde3c6762c31cfb438c9331376fe8887a7c',
      blockNumber: 46985225,
      name: 'DO NOT USE - Mock Weighted Pool',
      symbol: 'TEST',
      tokens: [
        '0x4200000000000000000000000000000000000006',
        '0x8c6487b86a73554431d514371184916b0b61b876',
      ],
      totalSupply: 1001133148290370n,
    }

    const item = mapDiscoveredPoolToListItem(dp)
    expect(item.address).toBe(dp.address)
    expect(item.chain).toBe('BASESEP')
    expect(item.type).toBe('WEIGHTED')
    expect(item.protocolVersion).toBe(3)
    expect(item.symbol).toBe('TEST')
    expect(item.factory).toBe(dp.factory)
  })
})
