import { describe, it, expect, vi, afterEach } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/*
  S114b: dev-E2E fork chain law. The dev harness forks ETHEREUM mainnet (anvil
  eth.drpc.org; upstream pool mocks), but the shipped chain law is Base + Base
  Sepolia only (S110) with both networks onchain-only (S113d). That strips
  Ethereum from every chain-fed subsystem in fork builds: token/token-price
  queries resolve to an EMPTY chain list (prices = 0 -> add-liquidity Next
  disabled; token dialog renders tokenless) and the create wizard derives its
  network label from defaultNetwork=Base (deploy CTA never reads 'Ethereum
  Mainnet'). Gate: NEXT_PUBLIC_E2E_DEV=1 extends the law with the fork chain —
  shipped builds never set the var and stay byte-identical.
*/

describe('balancer project config — E2E fork chain law', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function importConfig() {
    vi.stubEnv('NEXT_PUBLIC_BALANCER_API_URL', 'https://test.invalid/graphql')
    vi.stubEnv('NEXT_PUBLIC_PROJECT_ID', 'balancer')

    const [{ ProjectConfigBalancer }, { toApiNetworks }] = await Promise.all([
      import('./balancer'),
      import('../getProjectConfig'),
    ])

    return { config: ProjectConfigBalancer, toApiNetworks }
  }

  it('ships the S110 law unchanged when the E2E fork gate is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '')
    const { config, toApiNetworks } = await importConfig()

    expect(config.supportedNetworks).toEqual([GqlChainValues.Base, GqlChainValues.BaseSepolia])

    expect(config.defaultNetwork).toBe(GqlChainValues.Base)
    // S113d: every shipped chain is onchain-only -> no upstream chain query at all.
    expect(toApiNetworks(config.supportedNetworks)).toEqual([])

    expect(config.onchainOnlyNetworks).toEqual([GqlChainValues.Base, GqlChainValues.BaseSepolia])
  })

  it('extends the law with the ethereum fork chain when NEXT_PUBLIC_E2E_DEV=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '1')
    const { config, toApiNetworks } = await importConfig()

    expect(config.supportedNetworks).toContain(GqlChainValues.Mainnet)
    expect(config.defaultNetwork).toBe(GqlChainValues.Mainnet)
    // Fork chain must be API-queryable (tokens/prices/dialog flows) while the
    // Rootstock chains stay onchain-only even under the gate.
    expect(toApiNetworks(config.supportedNetworks)).toEqual([GqlChainValues.Mainnet])

    expect(config.onchainOnlyNetworks).toEqual([GqlChainValues.Base, GqlChainValues.BaseSepolia])
  })
})
