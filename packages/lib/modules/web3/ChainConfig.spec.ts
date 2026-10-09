import { describe, it, expect, vi, afterEach } from 'vitest'
import { mainnet, base, baseSepolia } from 'wagmi/chains'

/*
  S114: the dev-E2E harness impersonates against an ETHEREUM mainnet anvil fork
  (workflow forks eth.drpc.org; dev specs use ethereum pool mocks). ROOTSTOCK's
  shipped chain law is Base + Base Sepolia only (S110), so wagmi rejects the
  fork connect (ChainNotConfiguredError) and every impersonating E2E test times
  out waiting for the wallet Avatar. The gate: NEXT_PUBLIC_E2E_DEV=1 appends the
  ethereum fork chain to the wagmi config — shipped builds never set it.
*/

describe('ChainConfig fork-chain gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function importChains() {
    vi.stubEnv('NEXT_PUBLIC_BALANCER_API_URL', 'https://test.invalid/graphql')
    vi.stubEnv('NEXT_PUBLIC_PROJECT_ID', 'balancer')
    const { chains } = await import('./ChainConfig')
    return chains.map(chain => chain.id)
  }

  it('ships Base + Base Sepolia only when the E2E fork gate is off', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '')
    const ids = await importChains()

    expect(ids).toContain(base.id)
    expect(ids).toContain(baseSepolia.id)
    expect(ids).not.toContain(mainnet.id)
  })

  it('appends the ethereum fork chain when NEXT_PUBLIC_E2E_DEV=1', async () => {
    vi.stubEnv('NEXT_PUBLIC_E2E_DEV', '1')
    const ids = await importChains()

    expect(ids).toContain(base.id)
    expect(ids).toContain(baseSepolia.id)
    expect(ids).toContain(mainnet.id)
  })
})
