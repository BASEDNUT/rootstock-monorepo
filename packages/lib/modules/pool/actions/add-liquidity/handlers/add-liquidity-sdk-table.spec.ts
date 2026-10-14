import { describe, expect, it, vi } from 'vitest'
import { ROOTSTOCK_DEPLOYMENTS } from '@repo/lib/config/rootstock-deployments'

/**
 * Static SDK patch law (import-order independence): the patched
 * @balancer/sdk package itself must carry OUR verified Base mainnet (8453)
 * deployment addresses in the address table. Liquidity, create, and LBP
 * flows import the SDK directly — if the table were only corrected by a
 * runtime side-effect that loads with the swap handler module, every flow
 * that never loads the swap handler would route mainnet transactions to
 * the upstream deployment instead of ours.
 *
 * This spec deliberately imports an add-liquidity helper module FIRST and
 * never imports the swap handler. It must pass in ANY import order.
 */
vi.resetModules()

describe('SDK address table — static patch (import-order independent)', () => {
  it(
    'add-liquidity path sees our Base mainnet addresses without the swap handler loading',
    { timeout: 30_000 },
    async () => {
      // Import an add-liquidity module first — never the swap handler.
      await import('./add-liquidity.utils')

      const { balancerV3Contracts } = await import('@balancer/sdk')
      const deployment = ROOTSTOCK_DEPLOYMENTS[8453]!

      expect(balancerV3Contracts.Router[8453]).toBe(deployment.router)
      expect(balancerV3Contracts.Vault[8453]).toBe(deployment.vault)
      expect(balancerV3Contracts.BatchRouter[8453]).toBe(deployment.batchRouter)

      expect(balancerV3Contracts.CompositeLiquidityRouter[8453]).toBe(
        deployment.compositeLiquidityRouter
      )

      expect(balancerV3Contracts.VaultAdmin[8453]).toBe(deployment.vaultAdmin)
      expect(balancerV3Contracts.VaultExtension[8453]).toBe(deployment.vaultExtension)

      expect(balancerV3Contracts.UnbalancedAddViaSwapRouter[8453]).toBe(
        deployment.unbalancedAddViaSwapRouter
      )

      expect(balancerV3Contracts.BufferRouter[8453]).toBe(deployment.bufferRouter)

      expect(balancerV3Contracts.WeightedPoolFactory[8453]).toBe(
        deployment.factories.weightedPoolFactory
      )

      expect(balancerV3Contracts.StablePoolFactory[8453]).toBe(
        deployment.factories.stablePoolFactory
      )

      expect(balancerV3Contracts.StableSurgePoolFactory[8453]).toBe(
        deployment.factories.stableSurgePoolFactory
      )

      expect(balancerV3Contracts.GyroECLPPoolFactory[8453]).toBe(
        deployment.factories.gyroEclpPoolFactory
      )

      expect(balancerV3Contracts.ReClammPoolFactory[8453]).toBe(
        deployment.factories.reClammPoolFactory
      )

      expect(balancerV3Contracts.LBPoolFactory[8453]).toBe(deployment.factories.lbPoolFactory)

      expect(balancerV3Contracts.FixedPriceLBPoolFactory[8453]).toBe(
        deployment.factories.fixedPriceLbPoolFactory
      )

      expect(balancerV3Contracts.MevCaptureHook[8453]).toBe(deployment.hooks.mevCaptureHook)
      expect(balancerV3Contracts.StableSurgeHook[8453]).toBe(deployment.hooks.stableSurgeHook)
    }
  )

  it('foreign chains keep the upstream deployment (dev fork harness compatibility)', async () => {
    await import('./add-liquidity.utils')
    const { balancerV3Contracts } = await import('@balancer/sdk')

    // A foreign chain must resolve to the upstream deployment, never to
    // ours — the dev E2E harness forks Ethereum mainnet through the
    // upstream deployment.
    const foreignRouter = balancerV3Contracts.Router[42161]
    expect(typeof foreignRouter).toBe('string')
    expect(foreignRouter).not.toBe(ROOTSTOCK_DEPLOYMENTS[8453]!.router)
  })
})
