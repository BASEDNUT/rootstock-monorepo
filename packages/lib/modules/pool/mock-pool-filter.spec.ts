import { describe, it, expect } from 'vitest'
import { isMockPoolName, getBakedPools } from './onchain-pool-fetch'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import bakedRegistryBaseJson from './baked-pool-registry-base.json'

/**
 * repo law (2026-09-24): pools page showed E2E mock junk ('DO NOT USE -
 * Mock...') from Phase-1 battery scripts. Real named pool now deployed
 * ('Rootstock WETH/BAL Pool'). Mock-named pools NEVER display.
 *
 * FIX-6: getBakedPools is per-chain — the Base Sepolia snapshot stays
 * baked-pool-registry.json; Base mainnet has baked-pool-registry-base.json.
 */

type BakedRegistryFile = {
  chain: string
  chainId: number
  pools: { address: string; name?: string; symbol?: string }[]
}

describe('Mock pool filter (2026-09-24)', () => {
  it('flags DO NOT USE names as mock (case-insensitive)', () => {
    expect(isMockPoolName('DO NOT USE - Mock Weighted Pool')).toBe(true)
    expect(isMockPoolName('do not use - mock lbp')).toBe(true)
    expect(isMockPoolName('  DO NOT USE - Mock Gyro Pool')).toBe(true)
  })

  it('passes real pool names', () => {
    expect(isMockPoolName('Rootstock WETH/BAL Pool')).toBe(false)
    expect(isMockPoolName('')).toBe(false)
    expect(isMockPoolName(undefined)).toBe(false)
  })

  it('getBakedPools(chain) never returns mock-named pools (both chains)', () => {
    for (const pools of [
      getBakedPools(GqlChainValues.BaseSepolia),
      getBakedPools(GqlChainValues.Base),
    ]) {
      for (const p of pools) {
        expect(isMockPoolName(p.name), `mock pool leaked: ${p.name}`).toBe(false)
      }
    }
  })

  it('real deployed pool is present in the Sepolia baked registry', () => {
    const pools = getBakedPools(GqlChainValues.BaseSepolia)
    const real = pools.find(p => p.name === 'Rootstock WETH/BAL Pool')
    expect(real).toBeDefined()
    expect(real!.address.toLowerCase()).toBe('0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7')
    // per-chain law: Sepolia registry items are tagged BASESEP
    expect(real!.chain).toBe(GqlChainValues.BaseSepolia)
  })

  it('mainnet baked registry exists with chainId 8453 (FIX-6)', () => {
    const registry = bakedRegistryBaseJson as BakedRegistryFile
    expect(registry.chainId).toBe(8453)
    expect(registry.chain).toBe('BASE')
    expect(Array.isArray(registry.pools)).toBe(true)
  })

  it('mainnet displayed pools are all mock-filtered (honest zero until first real pool)', () => {
    // FIX-6 honest state: every mainnet pool created so far is a
    // mock-named battery fixture — the registry bakes only real named pools
    // (generator filter), so displayed mainnet pools are zero today. The
    // LAW (never display mock names) holds for whatever the registry carries.
    const registry = bakedRegistryBaseJson as BakedRegistryFile

    for (const p of registry.pools) {
      expect(
        isMockPoolName(p.name) || isMockPoolName(p.symbol),
        `mock-named pool baked into mainnet registry: ${p.name}`
      ).toBe(false)
    }

    // displayed mainnet pools carry the BASE chain tag
    for (const p of getBakedPools(GqlChainValues.Base)) {
      expect(p.chain).toBe(GqlChainValues.Base)
    }
  })
})
