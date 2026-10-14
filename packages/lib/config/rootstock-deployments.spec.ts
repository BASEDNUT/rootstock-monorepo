import { describe, expect, it } from 'vitest'
import { getAddress } from 'viem'
import { AddressProvider } from '@balancer/sdk'
import {
  ROOTSTOCK_DEPLOYMENTS,
  getRootstockDeployment,
  getRootstockVault,
  type RootstockDeployment,
} from './rootstock-deployments'

/**
 * FIX-1 (F-03a): the canonical Rootstock address registry — the ONE
 * immutable, chain-specific source every address consumer resolves from
 * (network config, call sites, SDK table patch). Kills literal duplication
 * and the import-order fragility class (F-03).
 *
 * Values: rootstock/LIVE_DEPLOYMENTS.md — byte-checked against
 * modules/swap/handlers/onchain-swap-sdk-table.spec.ts (both chains).
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const ZERO = '0x0000000000000000000000000000000000000000'

function expectValidAddress(a: string | undefined, label: string) {
  expect(a, `${label} missing`).toMatch(ADDRESS_RE)
  expect(a, `${label} not EIP-55 checksummed`).toBe(getAddress(a as string))
  expect(a, `${label} is zero address`).not.toBe(ZERO)
}

function expectValidDeployment(d: RootstockDeployment, label: string) {
  expectValidAddress(d.vault, `${label} vault`)
  expectValidAddress(d.router, `${label} router`)
  expectValidAddress(d.batchRouter, `${label} batchRouter`)
  expectValidAddress(d.compositeLiquidityRouter, `${label} compositeLiquidityRouter`)
  expectValidAddress(d.vaultAdmin, `${label} vaultAdmin`)
  expectValidAddress(d.vaultExtension, `${label} vaultExtension`)
  expectValidAddress(d.unbalancedAddViaSwapRouter, `${label} unbalancedAddViaSwapRouter`)
  expectValidAddress(d.bufferRouter, `${label} bufferRouter`)
  expectValidAddress(d.factories.weightedPoolFactory, `${label} weightedPoolFactory`)
  expectValidAddress(d.factories.stablePoolFactory, `${label} stablePoolFactory`)
  expectValidAddress(d.factories.stableSurgePoolFactory, `${label} stableSurgePoolFactory`)
  expectValidAddress(d.factories.gyro2ClpPoolFactory, `${label} gyro2ClpPoolFactory`)
  expectValidAddress(d.factories.gyroEclpPoolFactory, `${label} gyroEclpPoolFactory`)
  expectValidAddress(d.factories.reClammPoolFactory, `${label} reClammPoolFactory`)
  expectValidAddress(d.factories.lbPoolFactory, `${label} lbPoolFactory`)
  expectValidAddress(d.factories.fixedPriceLbPoolFactory, `${label} fixedPriceLbPoolFactory`)
  expectValidAddress(d.hooks.mevCaptureHook, `${label} mevCaptureHook`)
  expectValidAddress(d.hooks.stableSurgeHook, `${label} stableSurgeHook`)
}

describe('rootstock-deployments — canonical registry (FIX-1)', () => {
  it('carries exactly our two chains', () => {
    expect(Object.keys(ROOTSTOCK_DEPLOYMENTS).sort()).toEqual(['8453', '84532'])
  })

  it('every value is a valid, EIP-55 checksummed, non-zero address (both chains)', () => {
    for (const [chainId, d] of Object.entries(ROOTSTOCK_DEPLOYMENTS)) {
      expectValidDeployment(d, chainId)
    }
  })

  it('pins the funds-critical 8453 literals (LIVE_DEPLOYMENTS.md)', () => {
    const d = getRootstockDeployment(8453)
    expect(d.vault).toBe('0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7')
    expect(d.router).toBe('0xc8dcC030C81635Da8df2D7fb35573E661B01cDCe')
    expect(d.batchRouter).toBe('0x1428F95C891669f49299634076292215b2B78A31')
    expect(d.compositeLiquidityRouter).toBe('0xA14865dC542e075F6c3e3c8D49be68a1b2D1a758')
    expect(d.vaultAdmin).toBe('0xFbE459C6D811d474464F0209296590BBe35814Ca')
    expect(d.vaultExtension).toBe('0x2234Add4f8284e98cA51830678D6A66553506a07')
    expect(d.unbalancedAddViaSwapRouter).toBe('0x9e586F22ab23A0040231E78a4d021B5f761036E5')
    expect(d.bufferRouter).toBe('0xEa94Cee1C04E50e43935c4078F69B68df3Dc3946')
    expect(d.hooks.mevCaptureHook).toBe('0xfE807044D0329BD96aEa42A78F091c2Db1069f42')
    expect(d.hooks.stableSurgeHook).toBe('0x2Bdde9A6e0f9ad3f7349E09617cF7fEB655c5981')
  })

  it('pins the 84532 funds-critical literals (LIVE_DEPLOYMENTS.md)', () => {
    const d = getRootstockDeployment(84532)
    expect(d.vault).toBe('0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9')
    expect(d.router).toBe('0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759')
    expect(d.batchRouter).toBe('0x41978EB90477d4D971dF22111B2d09679f4DadA6')
    expect(d.compositeLiquidityRouter).toBe('0x5808B214B66C70e6c0759803AbF3498c2c78F437')
    expect(d.vaultAdmin).toBe('0xC67111C130b1380E5ba027733315DE82bB5A6837')
    expect(d.vaultExtension).toBe('0x8e86fDf21a578cDB01F1A58c71a2ef21dBBE2A8E')
    expect(d.unbalancedAddViaSwapRouter).toBe('0xbbEc9F2c69037852A86aB3F97326172649E82337')
    expect(d.bufferRouter).toBe('0xe1c7A291D4eBa814f36Ec96fD10F343A53BFa1D7')
    expect(d.hooks.mevCaptureHook).toBe('0x7E50a9dB8252414AAD240E08b9ed4176C4D64888')
    expect(d.hooks.stableSurgeHook).toBe('0x581e1dE0C136134AF479d09619b5f950420A427D')
  })

  it('carries the gyro2clp factory for both chains (deployed, LIVE_DEPLOYMENTS.md)', () => {
    // Optional in the interface (SDK 6.2.0 table has no Gyro2CLP key — the
    // handler patch keeps a guard), but DEPLOYED on both our chains.
    expect(getRootstockDeployment(8453).factories.gyro2ClpPoolFactory).toBe(
      '0x8dA17C9a51B3BBc4A4C951eDCE5cD9764e42a985'
    )

    expect(getRootstockDeployment(84532).factories.gyro2ClpPoolFactory).toBe(
      '0x458d984F6216DAffC9dA4577Fc949BcAb0e52b6D'
    )
  })

  it('getRootstockDeployment returns the chain-matching registry entry', () => {
    expect(getRootstockDeployment(8453)).toBe(ROOTSTOCK_DEPLOYMENTS[8453])
    expect(getRootstockDeployment(84532)).toBe(ROOTSTOCK_DEPLOYMENTS[84532])
  })

  it('getRootstockDeployment throws for chains we did not deploy', () => {
    expect(() => getRootstockDeployment(1)).toThrow()
    expect(() => getRootstockDeployment(999)).toThrow()
  })

  it('getRootstockVault returns the chain vault (FIX-4 consumer)', () => {
    expect(getRootstockVault(8453)).toBe('0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7')
    expect(getRootstockVault(84532)).toBe('0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9')
  })

  it('getRootstockVault falls back to upstream for foreign chains (E2E dev harness)', () => {
    // The dev E2E harness runs an Ethereum-mainnet anvil fork (chainId 1).
    // Our chains resolve STRICTLY from the registry; foreign chains fall
    // back to the upstream deployment (their chain, their vault) instead of
    // throwing — the strict throw killed wizard rendering in the harness.
    for (const chainId of [1, 999]) {
      expect(getRootstockVault(chainId)).toBe(AddressProvider.Vault(chainId))
    }

    expect(getRootstockVault(1)).toBe('0xbA1333333333a1BA1108E8412f11850A5C319bA9')
  })
})
