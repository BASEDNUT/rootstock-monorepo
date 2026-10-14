import { describe, expect, it } from 'vitest'
import { zeroAddress, getAddress } from 'viem'
import { getNetworkConfig } from './index'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { getRootstockDeployment } from '../rootstock-deployments'

/**
 * (F-03b): base.ts verified literals + honest zeroes.
 *
 * Upstream AddressProvider.*(base.id) resolved Balancer's LIVE Base
 * infrastructure (their vault/routers/relayer/minter) — the F-03 misroute
 * class: our users would route swaps/adds through THEIR deployment.
 * Every balancer.* address must now resolve from OUR canonical registry;
 * contracts we did not deploy carry honest zeroes.
 */

describe('base.ts network config ()', () => {
  const config = getNetworkConfig(GqlChainValues.Base)
  const contracts = config.contracts
  const registry = getRootstockDeployment(8453)

  it('every balancer.* address equals OUR canonical registry (8453)', () => {
    expect(contracts.balancer.vaultV3).toBe(registry.vault)
    expect(contracts.balancer.router).toBe(registry.router)
    expect(contracts.balancer.batchRouter).toBe(registry.batchRouter)

    expect(contracts.balancer.compositeLiquidityRouterBoosted).toBe(
      registry.compositeLiquidityRouter
    )

    expect(contracts.balancer.vaultAdminV3).toBe(registry.vaultAdmin)

    expect(contracts.balancer.unbalancedAddViaSwapRouter).toBe(registry.unbalancedAddViaSwapRouter)
  })

  it('carries no upstream AddressProvider literals (misroute)', () => {
    const balancer = JSON.stringify(contracts.balancer)
    // Upstream Balancer Base values (onchain-swap-sdk-table.spec.ts UPSTREAM set)
    expect(balancer).not.toContain('0x85a80afee867aDf27B50BdB7b76DA70f1E853062')
    expect(balancer).not.toContain('0x4132f7AcC9dB7A6cF7BE2Dd3A9DC8b30C7E6E6c8')
    expect(balancer).not.toContain('0x9dA18982a33FD0c7051B19F0d7C76F2d5E7e017c')
    expect(balancer).not.toContain('0x7fA49Df302a98223d98D115fc4FCD275576f6faA')
    expect(balancer).not.toContain('0x35fFB749B273bEb20F40f35EdeB805012C539864')
    expect(balancer).not.toContain('0x0E8B07657D719B86e06bF0806D6729e3D528C9A9')
    expect(balancer).not.toContain('0xbA1333333333a1BA1108E8412f11850A5C319bA9')
  })

  it('contracts we did NOT deploy carry honest zeroes (misroute class)', () => {
    expect(contracts.balancer.relayerV6).toBe(zeroAddress)
    expect(contracts.balancer.minter).toBe(zeroAddress)
    expect(contracts.merkl?.claims).toBe(zeroAddress)
    // The recovered-funds surface is removed — no signature registry exists.
    expect('signatureRegistry' in contracts).toBe(false)
  })

  it('bCoWFactory + veDelegationProxy honestly absent (not deployed by us)', () => {
    expect(contracts.balancer.bCoWFactory).toBeUndefined()
    expect(contracts.veDelegationProxy).toBeUndefined()
  })

  it('permit2 keeps the canonical predeploy (correct, universal)', () => {
    // Verified live on Base (eth_getCode) + SDK PERMIT2[8453]:
    // 0x000000000022D473030F116dDEE9F6B43aC78BA3 carries Permit2 bytecode.
    expect(contracts.permit2).toBe('0x000000000022D473030F116dDEE9F6B43aC78BA3')
    expect(contracts.permit2).toBe(getAddress(contracts.permit2 as string))
  })

  it('our chains carry no veBAL sync / aura surface', () => {
    expect(config.supportsVeBalSync).toBe(false)
    expect(config.hasAura).toBe(false)
  })

  it('keeps real Base token surface (popularTokens + bal address)', () => {
    expect(config.tokens.addresses.bal).toBe('0x4158734d47fc9692176b5085e0f52ee0da5d47f1')

    expect(Object.keys(config.tokens.popularTokens || {}).length).toBeGreaterThan(0)
    expect(config.lbps?.collateralTokens?.length).toBeGreaterThan(0)
  })
})
