import { describe, it, expect } from 'vitest'
import { isMockPoolName, getBakedPools } from './onchain-pool-fetch'

/**
 * S100b Boss law (2026-09-24): pools page showed E2E mock junk ('DO NOT USE -
 * Mock ...') from Phase-1 battery scripts. Real named pool now deployed
 * ('Rootstock WETH/BAL Pool'). Mock-named pools NEVER display.
 */
describe('Mock pool filter (Boss 2026-09-24)', () => {
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

  it('getBakedPools never returns mock-named pools', () => {
    const pools = getBakedPools()

    for (const p of pools) {
      expect(isMockPoolName(p.name), `mock pool leaked: ${p.name}`).toBe(false)
    }
  })

  it('real deployed pool is present in baked registry', () => {
    const pools = getBakedPools()
    const real = pools.find(p => p.name === 'Rootstock WETH/BAL Pool')
    expect(real).toBeDefined()
    expect(real!.address.toLowerCase()).toBe('0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7')
  })
})
