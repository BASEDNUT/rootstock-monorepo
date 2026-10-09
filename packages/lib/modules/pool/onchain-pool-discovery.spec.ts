import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  FACTORY_TO_POOL_TYPE,
  POOL_REGISTERED_TOPIC0,
  getOnchainDiscoveryRpcUrl,
  getOnchainScanConfig,
  mapDiscoveredPoolToListItem,
  type DiscoveredPool,
} from './onchain-pool-discovery'

// Rootstock law: Base Sepolia pool discovery is fully onchain — Vault events
// + direct reads. NEVER the remote API. sepolia.base.org only (publicnode's
// historical log index is broken — verified live 2026-09-22).
describe('onchain pool discovery', () => {
  it('maps all 8 factories to pool types', () => {
    // S113d: 8 Sepolia + 8 Base mainnet factories (deployed 2026-10-03)
    expect(FACTORY_TO_POOL_TYPE.size).toBe(16)
    expect(FACTORY_TO_POOL_TYPE.get('0x277d7dde3c6762c31cfb438c9331376fe8887a7c')).toBe('WEIGHTED')
    expect(FACTORY_TO_POOL_TYPE.get('0x24ab9fba48e54b05c24a02122c4c40fd2018ba10')).toBe('STABLE')
    expect(FACTORY_TO_POOL_TYPE.get('0x6cd1150ccc00e0d00cd3f671a8bdf00d38f5be6e')).toBe('STABLE')
    expect(FACTORY_TO_POOL_TYPE.get('0x928e433f50fa579c9be5f7e1273f1db46d630ee1')).toBe('RECLAMM')

    // S113d: Base mainnet factories (S113c live deploy 2026-10-03)
    expect(FACTORY_TO_POOL_TYPE.get('0x9a5bd368c8da0d7fad33fc89b6be4e39e5a33f92')).toBe('WEIGHTED')
    expect(FACTORY_TO_POOL_TYPE.get('0x730bf6af759e9e74aa6f9f0950e233df974d1859')).toBe('RECLAMM')

    expect(FACTORY_TO_POOL_TYPE.get('0xf5cac7d8e637d2827c07c44ae4767093647b0867')).toBe(
      'LIQUIDITY_BOOTSTRAPPING'
    )

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

  it('wires the Base mainnet scan config (S113d)', () => {
    // Deployed 2026-10-03 (S113c live): Vault at CREATE2-exact prediction.
    const base = getOnchainScanConfig('BASE')
    expect(base).toBeDefined()
    expect(base?.chainId).toBe(8453)
    expect(base?.vault).toBe('0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7')
    expect(base?.fromBlock).toBe(52131550)
    expect(base?.rpcUrl).toBe('https://base.publicnode.com')
    // Both Rootstock networks carry scan configs
    expect(getOnchainScanConfig('BASESEP')).toBeDefined()
  })

  describe('isDeploymentReadyChain (S114b fork gate)', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    async function importHelper() {
      const mod = await import('./onchain-pool-discovery')
      return mod.isDeploymentReadyChain
    }

    it('ships the honest gate when the E2E fork gate is off', async () => {
      vi.stubEnv('NEXT_PUBLIC_BALANCER_API_URL', 'https://test.invalid/graphql')
      vi.stubEnv('NEXT_PUBLIC_PROJECT_ID', 'balancer')
      vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '')
      const isDeploymentReadyChain = await importHelper()

      // Shipped law unchanged: only OUR deployed chains are ready.
      expect(isDeploymentReadyChain('BASE')).toBe(true)
      expect(isDeploymentReadyChain('BASESEP')).toBe(true)
      expect(isDeploymentReadyChain('MAINNET')).toBe(false)
      expect(isDeploymentReadyChain(undefined)).toBe(false)
    })

    it('treats every chain as deployment-ready under the fork gate', async () => {
      vi.stubEnv('NEXT_PUBLIC_BALANCER_API_URL', 'https://test.invalid/graphql')
      vi.stubEnv('NEXT_PUBLIC_PROJECT_ID', 'balancer')
      vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '1')
      const isDeploymentReadyChain = await importHelper()

      // Fork builds run against the upstream Ethereum fork where the upstream
      // factories DO exist — deployment-capable for spec flows.
      expect(isDeploymentReadyChain('MAINNET')).toBe(true)
      expect(isDeploymentReadyChain('BASE')).toBe(true)
      expect(isDeploymentReadyChain(undefined)).toBe(false)
    })
  })
})
