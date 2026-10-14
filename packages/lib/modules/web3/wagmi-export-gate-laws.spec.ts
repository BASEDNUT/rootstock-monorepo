import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Export-gate laws for the wagmi layer: the impersonation/mock-connector
// surface must never reach the static export, and production modules must
// never import from the test tree (test clients and anvil fixtures stay
// out of shipped bundles).

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

const wagmiConfigSrc = read('packages/lib/modules/web3/WagmiConfig.ts')

const PROD_MODULES = [
  'packages/lib/modules/web3/ChainConfig.tsx',
  'packages/lib/modules/web3/transports.ts',
  'packages/lib/modules/web3/WagmiConfig.ts',
  'packages/lib/modules/web3/UserAccountProvider.tsx',
  'packages/lib/modules/web3/impersonation/createMockConnector.ts',
]

describe('wagmi export-gate laws', () => {
  it('mock connector is gated off the static export', () => {
    expect(wagmiConfigSrc).toContain('!isProd && !isIpfsExportMode()')
  })

  it('production modules never import from the test tree', () => {
    for (const p of PROD_MODULES) {
      const src = read(p)
      expect(src, `${p} must not import test utils`).not.toContain('@repo/lib/test')
    }
  })

  it('non-served chains never route through the private proxy outside fork mode', () => {
    const chainConfig = read('packages/lib/modules/web3/ChainConfig.tsx')
    expect(chainConfig).toContain('[GqlChainValues.Mainnet]: shouldUseAnvilFork')
    expect(chainConfig).toContain(': undefined')
  })

  it('fork constants live in the production tree and the test helper re-exports them', () => {
    expect(
      existsSync(resolve(ROOT, 'packages/lib/modules/web3/impersonation/fork-constants.ts'))
    ).toBe(true)

    const helpers = read('packages/lib/test/utils/wagmi/fork.helpers.ts')
    expect(helpers).toContain('impersonation/fork-constants')
  })
})
