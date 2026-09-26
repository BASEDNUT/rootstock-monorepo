/* S101 D-fixes (Boss-approved 2026-09-25): D4 activity-caption epoch guard,
 * D5 baked holdersCount, D6 base-sep-only deployment, D1 regression cover. */
import { describe, expect, it } from 'vitest'
import { getPoolActivityDateCaption } from '../pool.helpers'
import bakedRegistryJson from '../baked-pool-registry.json'

type BakedPool = {
  address: string
  blockTimestamp?: number
  swapFee?: string
  holdersCount?: number
}

const bakedRegistry = bakedRegistryJson as { pools: BakedPool[] }
const REAL_POOL = '0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7'

describe('S101 D4: pool activity date caption', () => {
  it('guards zero/missing min date (no indexed events)', () => {
    expect(getPoolActivityDateCaption(0)).toBe('yet')
    expect(getPoolActivityDateCaption(-1)).toBe('yet')
  })

  it('still works for real timestamps', () => {
    const nowSeconds = Math.floor(Date.now() / 1000)
    expect(getPoolActivityDateCaption(nowSeconds)).toBe('today')
    expect(getPoolActivityDateCaption(nowSeconds - 86400)).toBe('since yesterday')
  })
})

describe('S101 D5 + D1 regression: baked registry fields', () => {
  it('real pool carries holdersCount > 0', () => {
    const real = bakedRegistry.pools.find(p => p.address.toLowerCase() === REAL_POOL)
    expect(real).toBeDefined()
    expect(Number(real!.holdersCount)).toBeGreaterThan(0)
  })

  it('real pool carries blockTimestamp (unix seconds) + swapFee', () => {
    const real = bakedRegistry.pools.find(p => p.address.toLowerCase() === REAL_POOL)
    expect(Number(real!.blockTimestamp)).toBeGreaterThan(1_700_000_000)
    expect(real!.swapFee).toBe('0.003')
  })
})
