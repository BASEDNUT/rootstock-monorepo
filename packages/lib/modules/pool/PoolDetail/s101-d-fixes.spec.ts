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

describe('S101c SDK patch: Base Sepolia (84532) addresses', () => {
  // Boss GO 2026-09-25 (WHERE THERE IS ONE THERE IS MORE — verify, audit,
  // fix). SDK 6.2.0 balancerV3Contracts has no 84532 entries, so
  // AddressProvider.Vault(84532 as never) threw 'Address not found' and the
  // add-liquidity page hard-crashed. Patch adds our verified addresses
  // from rootstock/LIVE_DEPLOYMENTS.md (S95 deploy).
  it('AddressProvider resolves Vault + VaultAdmin + VaultExtension on 84532', async () => {
    const { AddressProvider } = await import('@balancer/sdk')
    expect(AddressProvider.Vault(84532 as never)).toBe('0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9')

    expect(AddressProvider.VaultAdmin(84532 as never)).toBe(
      '0xC67111C130b1380E5ba027733315DE82bB5A6837'
    )

    expect(AddressProvider.VaultExtension(84532 as never)).toBe(
      '0x8e86fDf21a578cDB01F1A58c71a2ef21dBBE2A8E'
    )
  })

  it('AddressProvider resolves all routers on 84532', async () => {
    const { AddressProvider } = await import('@balancer/sdk')

    expect(AddressProvider.Router(84532 as never)).toBe(
      '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759'
    )

    expect(AddressProvider.BatchRouter(84532 as never)).toBe(
      '0x41978EB90477d4D971dF22111B2d09679f4DadA6'
    )

    expect(AddressProvider.BufferRouter(84532 as never)).toBe(
      '0xe1c7A291D4eBa814f36Ec96fD10F343A53BFa1D7'
    )

    expect(AddressProvider.CompositeLiquidityRouter(84532 as never)).toBe(
      '0x5808B214B66C70e6c0759803AbF3498c2c78F437'
    )

    expect(AddressProvider.UnbalancedAddViaSwapRouter(84532 as never)).toBe(
      '0xbbEc9F2c69037852A86aB3F97326172649E82337'
    )
  })
})
