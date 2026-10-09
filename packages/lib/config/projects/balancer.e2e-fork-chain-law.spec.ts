import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/*
  S114b: dev-E2E fork chain law. The dev harness forks ETHEREUM mainnet (anvil
  eth.drpc.org; upstream pool mocks), but the shipped chain law is Base + Base
  Sepolia only (S110/S113d). That strips Ethereum from every chain-fed
  subsystem in fork builds: token/token-price queries resolve to an EMPTY
  chain list (prices = 0 -> add-liquidity Next disabled; token dialog renders
  tokenless) and the create wizard derives its network label from
  defaultNetwork=Base (deploy CTA never reads 'Ethereum Mainnet').

  Law reconciliation (homepage-laws source detector): balancer.ts keeps the
  shipped law LITERALLY; the gate applies at the PROJECT_CONFIG consumption
  surface in getProjectConfig.ts — what TokensProvider, the token dialog, and
  the wizard actually read. Gate: NEXT_PUBLIC_E2E_DEV=1. Shipped builds never
  set the var and get the untouched shipped object.
*/

const BALANCER_SOURCE = readFileSync(resolve(__dirname, 'balancer.ts'), 'utf8')

describe('balancer project config — E2E fork chain law', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function importSurfaces() {
    vi.stubEnv('NEXT_PUBLIC_BALANCER_API_URL', 'https://test.invalid/graphql')
    vi.stubEnv('NEXT_PUBLIC_PROJECT_ID', 'balancer')

    const [{ PROJECT_CONFIG }, { toApiNetworks }] = await Promise.all([
      import('../getProjectConfig'),
      import('../getProjectConfig'),
    ])

    return { PROJECT_CONFIG, toApiNetworks }
  }

  it('balancer.ts keeps the shipped S110/S113d law literally (source lock)', () => {
    expect(BALANCER_SOURCE).toContain(
      'supportedNetworks: [GqlChainValues.Base, GqlChainValues.BaseSepolia],'
    )

    expect(BALANCER_SOURCE).toContain('defaultNetwork: GqlChainValues.Base,')
    expect(BALANCER_SOURCE).not.toContain('Mainnet')
    expect(BALANCER_SOURCE).not.toContain('forkChainLaw')
  })

  it('shipped PROJECT_CONFIG law unchanged when the E2E fork gate is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '')
    const { PROJECT_CONFIG, toApiNetworks } = await importSurfaces()

    expect(PROJECT_CONFIG.supportedNetworks).toEqual([
      GqlChainValues.Base,
      GqlChainValues.BaseSepolia,
    ])

    expect(PROJECT_CONFIG.defaultNetwork).toBe(GqlChainValues.Base)
    // S113d: every shipped chain is onchain-only -> no upstream chain query at all.
    expect(toApiNetworks(PROJECT_CONFIG.supportedNetworks)).toEqual([])

    expect(PROJECT_CONFIG.onchainOnlyNetworks).toEqual([
      GqlChainValues.Base,
      GqlChainValues.BaseSepolia,
    ])
  })

  it('extends PROJECT_CONFIG with the ethereum fork chain when NEXT_PUBLIC_E2E_DEV=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '1')
    const { PROJECT_CONFIG, toApiNetworks } = await importSurfaces()

    expect(PROJECT_CONFIG.supportedNetworks).toContain(GqlChainValues.Mainnet)
    expect(PROJECT_CONFIG.defaultNetwork).toBe(GqlChainValues.Mainnet)
    // Fork chain must be API-queryable (tokens/prices/dialog flows) while the
    // Rootstock chains stay onchain-only even under the gate.
    expect(toApiNetworks(PROJECT_CONFIG.supportedNetworks)).toEqual([GqlChainValues.Mainnet])

    expect(PROJECT_CONFIG.onchainOnlyNetworks).toEqual([
      GqlChainValues.Base,
      GqlChainValues.BaseSepolia,
    ])
  })
})
