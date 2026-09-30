import { existsSync, readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

/**
 * S106 primitive pages law (PRD-07):
 * - /mint + /wrap are top-menu app links (one page per factory)
 * - both pages exist as client components
 * - sitemap covers both routes (IPFS static export)
 * - factory tokens feed TokensProvider (pickers law: zero registry edits)
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const MONOREPO_ROOT = resolve(HERE, '../../../..')
const APP = resolve(MONOREPO_ROOT, 'apps/frontend-v3')

describe('primitive pages law (S106, PRD-07)', () => {
  it('nav exposes /mint and /wrap exactly once each', () => {
    const appLinks = PROJECT_CONFIG.links.appLinks
    expect(appLinks.filter(l => l.href === '/mint').length).toBe(1)
    expect(appLinks.filter(l => l.href === '/wrap').length).toBe(1)
  })

  it('mint + wrap pages exist as client components', () => {
    for (const p of ['mint', 'wrap']) {
      const file = resolve(APP, 'app/(app)', p, 'page.tsx')
      expect(existsSync(file), `${p}/page.tsx must exist`).toBe(true)

      expect(readFileSync(file, 'utf-8'), `${p} page must be a client component`).toContain(
        "'use client'"
      )
    }
  })

  it('sitemap covers /mint + /wrap', () => {
    const sitemap = readFileSync(resolve(APP, 'app/sitemap.ts'), 'utf-8')
    // S107: ROUTES array form (env-gated sitemap)
    expect(sitemap).toContain("'/mint'")
    expect(sitemap).toContain("'/wrap'")
  })

  it('factory tokens feed the token provider (pickers law)', () => {
    const provider = readFileSync(
      resolve(MONOREPO_ROOT, 'packages/lib/modules/tokens/TokensProvider.tsx'),
      'utf-8'
    )

    expect(provider).toContain('fetchOnchainFactoryTokens')
  })

  it('forms are ALWAYS visible — wallet only gates the action button (Boss 2026-09-28, /lbp law)', () => {
    for (const p of ['mint', 'wrap']) {
      const file = resolve(APP, 'app/(app)', p, 'page.tsx')
      const src = readFileSync(file, 'utf-8')
      // ConnectWallet must sit INSIDE the form Card (position law): the form
      // renders unconditionally; the wallet gates only the action button.
      // The old hide-behind-connect pattern put ConnectWallet BEFORE the Card.
      const connectAt = src.indexOf('<ConnectWallet')
      const cardAt = src.indexOf('<Card')
      expect(connectAt, `${p}: ConnectWallet must exist`).toBeGreaterThan(-1)
      expect(cardAt, `${p}: form Card must exist`).toBeGreaterThan(-1)

      expect(
        connectAt,
        `${p}: ConnectWallet must be INSIDE the form Card (action-area gate), not hiding the form`
      ).toBeGreaterThan(cardAt)
    }
  })

  it('GUI specificity laws (Boss 2026-09-28): decimals truth + previews + facts + advisories', () => {
    const primitivesConfig = readFileSync(
      resolve(MONOREPO_ROOT, 'packages/lib/modules/primitives/primitives.config.ts'),
      'utf8'
    )

    const mint = readFileSync(resolve(APP, 'app/(app)/mint/page.tsx'), 'utf-8')
    const wrap = readFileSync(resolve(APP, 'app/(app)/wrap/page.tsx'), 'utf-8')

    // Mint: 18 decimals is STANDARD + FIXED — stated on the page (verified
    // onchain: eth_call decimals() = 0x12).
    expect(mint, 'mint: decimals must be stated as standard 18').toContain('18 decimals')

    // Mint: live supply preview formats the number for readability.
    expect(mint, 'mint: supply preview must format the number').toMatch(
      /toLocaleString|Intl\.NumberFormat/
    )

    // Wrap: decimals INHERIT from the underlying — stated on the page.
    expect(wrap, 'wrap: decimals-inherit must be stated').toContain('inherit')

    // Wrap: reads the typed underlying ONCHAIN (real is-a-contract check —
    // the GUI never guesses, it verifies).
    expect(wrap, 'wrap: must read underlying metadata onchain').toContain('useReadContracts')

    // Wrap: fee-on-transfer advisory (ARD-06 risk — honest warning).
    expect(wrap, 'wrap: fee-on-transfer advisory must exist').toContain('fee-on-transfer')

    // Both: accidental-send honesty note (S105 audit law — owns nothing,
    // holds nothing; anything sent directly is unrecoverable).
    for (const [name, src] of [
      ['mint', mint],
      ['wrap', wrap],
    ] as const) {
      expect(src, `${name}: accidental-send honesty note must exist`).toContain('unrecoverable')
    }

    // Both: Blockscout explorer links (S105 verified explorer). S110: the
    // explorer URL now comes from the per-chain deployment config
    // (primitives.config PRIMITIVES_DEPLOYMENTS[chainId].explorerBase) — the
    // law asserts the mechanism (page reads deployment.explorerBase) plus
    // the config truth (blockscout for the Base Sepolia deployment).
    expect(mint, 'mint: per-chain explorer link must exist').toContain('deployment.explorerBase')
    expect(wrap, 'wrap: per-chain explorer link must exist').toContain('deployment.explorerBase')

    expect(
      primitivesConfig,
      'primitives.config: Base Sepolia explorer must be Blockscout'
    ).toContain('base-sepolia.blockscout.com')
  })
})
