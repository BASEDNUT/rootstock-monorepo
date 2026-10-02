import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../')
const read = (f: string) => readFileSync(`${HERE}/${f}`, 'utf8')

// Approved copy is asserted on whitespace-collapsed text so prettier's line
// wrapping never breaks the law.
const flat = (s: string) => s.replace(/\s+/g, ' ')

const hero = read('Hero.tsx')
const grow = read('Grow.tsx')
const atAGlance = read('AtAGlance.tsx')
const codeStack = read('CodeStack.tsx')
const code = read('Code.tsx')
const features = read('Features.tsx')
const landingSurface = [hero, grow, atAGlance, codeStack, code, features].join('')

const buildPromo = readFileSync(
  resolve(ROOT, 'packages/lib/shared/pages/PoolsPage/BuildPromo.tsx'),
  'utf8'
)

const useNav = readFileSync(resolve(ROOT, 'packages/lib/shared/components/navs/useNav.tsx'), 'utf8')

const navBar = readFileSync(resolve(ROOT, 'packages/lib/shared/components/navs/NavBar.tsx'), 'utf8')

const config = readFileSync(resolve(ROOT, 'packages/lib/config/projects/balancer.ts'), 'utf8')

const buildPopover = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/lib/components/navs/BuildPopover.tsx'),
  'utf8'
)

const mobileBuildAccordion = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/lib/components/navs/MobileBuildAccordion.tsx'),
  'utf8'
)

const nextConfig = readFileSync(resolve(ROOT, 'apps/frontend-v3/next.config.ts'), 'utf8')

const sitemap = readFileSync(resolve(ROOT, 'apps/frontend-v3/app/sitemap.ts'), 'utf8')

const marketingLayout = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/app/(marketing)/layout.tsx'),
  'utf8'
)

const safeHooks = readFileSync(resolve(ROOT, 'packages/lib/modules/web3/safe.hooks.tsx'), 'utf8')

const headerBanner = readFileSync(
  resolve(ROOT, 'packages/lib/modules/pool/actions/create/header/HeaderBanner.tsx'),
  'utf8'
)

const orbitalArtwork = resolve(
  ROOT,
  'apps/frontend-v3/public/images/landing/rootstock-orbital-root.webp'
)

const landingAll = [
  landingSurface,
  buildPromo,
  useNav,
  navBar,
  config,
  buildPopover,
  mobileBuildAccordion,
  marketingLayout,
  headerBanner,
].join('')

describe('homepage laws v8 — approved copy + orbital hero + IPFS interaction scope', () => {
  it('zero Balancer anywhere on homepage surfaces', () => {
    for (const surface of [
      landingSurface,
      buildPromo,
      useNav,
      navBar,
      buildPopover,
      mobileBuildAccordion,
      marketingLayout,
      headerBanner,
    ]) {
      expect(surface.match(/balancer/gi)).toBeNull()
    }
  })

  it('zero v3 strings on homepage surfaces', () => {
    for (const surface of [landingSurface, marketingLayout, headerBanner]) {
      expect(surface.match(/v3/gi)).toBeNull()
    }
  })

  it('no NUT/wNUT/orchard/graft tokens on homepage surfaces', () => {
    for (const banned of [/\\bwNUT\\b/, /\\bNUT\\b/, /\\borchard\\b/i, /\\bgraft\\b/i]) {
      expect(landingSurface.match(banned)).toBeNull()
    }
  })

  it('no external balancer links, no fabricated URLs', () => {
    for (const banned of [
      'docs.balancer.fi',
      'github.com/balancer',
      'balancer.fi',
      'dune.com/balancer',
      'immunefi.com/bug-bounty/balancer',
      'terminal.basednut.com',
      'youtu.be',
      'youtube.com',
    ]) {
      expect(landingAll).not.toContain(banned)
      expect(nextConfig).not.toContain(banned)
      expect(sitemap).not.toContain(banned)
    }
  })

  it('pools/portfolio links may exist on surfaces (restored Boss 2026-09-22); no upstream-domain links', () => {
    for (const surface of [
      landingSurface,
      buildPromo,
      useNav,
      navBar,
      buildPopover,
      mobileBuildAccordion,
    ]) {
      expect(surface).not.toContain('balancer.fi/')
    }
  })

  it('Test-Pools is gone from nav (Debug gone too — Boss 2026-09-25)', () => {
    expect(navBar).not.toContain('Test-Pools')
    // S101c: Debug page is NOT necessary (Boss 2026-09-25) and the hardcoded
    // NavBar block violated the nav law (config = sole nav source). Removed.
    expect(navBar).not.toContain('"/debug"')
  })

  it('navbar CTA is Learn more -> docs; hero keeps Launch app -> /swap (Boss 2026-10-01)', () => {
    expect(navBar).toContain('https://docs.basednut.com/rootstock')
    expect(navBar).toContain('Learn more')
    expect(hero).toContain('Launch app')
    expect(hero).toContain('"/swap"')
  })

  it('Videos + Audits stay deleted; Grow is RESTORED (Boss 2026-10-01)', () => {
    expect(existsSync(`${HERE}/Videos.tsx`)).toBe(false)
    expect(existsSync(`${HERE}/Audits.tsx`)).toBe(false)
    // Grow is back: real stats high on the page (live pool count from the
    // onchain discovery scan; engine facts ledger-verified). IPFS static
    // CAN fetch live data client-side — the removal premise was false.
    expect(existsSync(`${HERE}/Grow.tsx`)).toBe(true)
    const grow = read('Grow.tsx')
    expect(grow).toContain('useOnchainPoolDiscovery')
    expect(grow).toContain('Pools live')
    expect(hero).not.toContain('youtu.be')
    expect(hero).not.toContain('PlayVideoButton')
    expect(existsSync(`${HERE}/images/video-createCustomAMMs.png`)).toBe(false)
    expect(existsSync(`${HERE}/images/video-prototypePool.png`)).toBe(false)
    expect(existsSync(`${HERE}/images/video-createHook.png`)).toBe(false)
    expect(existsSync(`${HERE}/images/video-createRouter.png`)).toBe(false)
  })

  it('Contracts section is deleted (Boss 2026-10-01: 3-section approved copy)', () => {
    expect(existsSync(`${HERE}/Contracts.tsx`)).toBe(false)
  })

  it('approved copy v1 (Boss 2026-10-01) — three sections, exact headlines', () => {
    // Section 1 — Code Stack (CodeStack.tsx)
    expect(flat(codeStack)).toContain('Build the market, not the machinery.')

    expect(flat(codeStack)).toContain(
      'Rootstock provides a shared foundation for execution, accounting, routing, liquidity, and extensibility.'
    )

    // Section 2 — Simplicity (Code.tsx)
    expect(flat(code)).toContain('Minimal by design')
    expect(flat(code)).toContain('Pools define the logic. Rootstock handles the rest.')

    expect(flat(code)).toContain(
      'A pool only needs to express how its market behaves. The Root Vault handles balances, accounting, fees, scaling, and settlement, leaving pool contracts focused on the math that makes them unique.'
    )

    // Section 3 — Built into the stack (Features.tsx)
    expect(flat(features)).toContain('Built into the stack')

    expect(flat(features)).toContain(
      'Rootstock handles more of the difficult infrastructure at the protocol level, so every pool does not have to solve the same problems again.'
    )
  })

  it('approved copy v1 — all nine stack features present', () => {
    for (const title of [
      'LVR / MEV Mitigation',
      'Decimal Scaling',
      'Rate Scaling',
      'Liquidity Invariant Approximation',
      'Transient Accounting',
      'ERC20MultiToken',
      'Swap Fee Management',
      'Pool Creator Fees',
      'Pool Pause Manager',
    ]) {
      expect(flat(features)).toContain(`'${title}'`)
    }

    // feature bodies carry the approved plain-English explanations
    expect(flat(features)).toContain(
      'The Root Vault normalizes their values before they reach the pool, giving pool math a consistent 18-decimal format to work with.'
    )

    expect(flat(features)).toContain(
      'EIP-1153 makes this pattern efficient and enables more complex interactions without permanently storing every intermediate state.'
    )

    expect(flat(features)).toContain(
      'This gives developers a native way to build sustainable economics around new market designs.'
    )
  })

  it('banned Balancer marketing language stays dead (Boss 2026-10-01)', () => {
    const sections = codeStack + code + features

    for (const banned of [
      'Code less, build more',
      'Built for builders',
      'Technical highlights',
      'The engine',
      'keyFeatures',
      'stone-1.png',
      'stone-2.png',
    ]) {
      expect(sections).not.toContain(banned)
    }
  })

  it('AtAGlance system diagram section (Boss 2026-10-01, artwork v2 + copy v2 same day)', () => {
    expect(atAGlance).toContain('The system at a glance')
    // copy v2 (Boss editorial 2026-10-01): upload's original lines, no verbatim
    // of approved section copy, no 'Powered by Rootstock' (we ARE Rootstock —
    // the upload header duplicated the Section 1 headline and carried that
    // nonsensical h1; both permanently banned from this section).
    expect(flat(atAGlance)).toContain('A smaller core. A wider design space.')

    expect(flat(atAGlance)).toContain(
      'Accounting, balances, fees, and scaling stay in the Root Vault.'
    )

    expect(flat(atAGlance)).toContain('Pools carry only their market math.')
    expect(atAGlance).not.toContain('Powered by Rootstock')
    expect(atAGlance).not.toContain('Build the market, not the machinery')
    // artwork v2 (Boss upload): Root Vault seed core + Pools/Edges/Markets nodes
    expect(atAGlance).toContain('ROOT VAULT')
    expect(atAGlance).toContain('SHARED CORE')
    expect(atAGlance).toContain('Pools')
    expect(atAGlance).toContain('Edges')
    expect(atAGlance).toContain('Markets')
    expect(atAGlance).toContain('pool * vaults')
    expect(atAGlance).toContain('hooks · router')
    expect(atAGlance).toContain('wrappers · LBP')
    expect(atAGlance).toContain('<svg')
  })

  it('hero orbital-root artwork overlay (Boss 2026-10-01)', () => {
    // foreground overlay, right-anchored, masked fade toward the left,
    // non-interactive, beneath the copy layer
    expect(hero).toContain('rootstock-orbital-root.webp')
    expect(hero).toContain('pointerEvents="none"')
    expect(hero).toContain('maskImage')
    expect(hero).toContain('WebkitMaskImage')
    expect(hero).toContain('zIndex={1}')
    expect(hero).toContain('zIndex={2}')
    expect(existsSync(orbitalArtwork)).toBe(true)
    // hero copy and CTA structure unchanged
    expect(hero).toContain('Custom markets made simple')
    expect(hero).toContain('Launch app')
    expect(hero).toContain('Create a pool')
    expect(hero).toContain('SoilBg')
  })

  // S101c lint fix (no-useless-assignment): read upstream blob via helper
  // so no dead initializer exists.
  function readUpstreamOrNull(f: string): string | null {
    try {
      return execSync(
        `git show 'origin/main:apps/frontend-v3/app/(marketing)/_lib/landing-v3/${f}'`,
        { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
    } catch {
      return null // upstream file missing — nothing to compare
    }
  }

  it('NO VERBATIM COPY from upstream balancer landing files', () => {
    // Extract string literals (>=6 words) from upstream versions of our live
    // landing files and assert none appear verbatim in our live files.
    const files = [
      'Hero.tsx',
      'Grow.tsx',
      'AtAGlance.tsx',
      'CodeStack.tsx',
      'Code.tsx',
      'Features.tsx',
    ]

    for (const f of files) {
      // eslint no-useless-assignment: read via helper, no dead initializer
      const upstreamOrNull = readUpstreamOrNull(f)
      if (upstreamOrNull === null) continue // upstream file missing
      const upstream = upstreamOrNull

      const literals = [...upstream.matchAll(/'([^'\n]{30,})'|"([^"\n]{30,})"/g)]
        .map(m => m[1] || m[2] || '')
        .filter(
          s =>
            s.split(/\s+/).length >= 6 &&
            !s.startsWith('/') &&
            !s.includes('http') &&
            !s.includes('{') &&
            !s.includes('linear(') &&
            !s.includes('gradient')
        )

      const ours = read(f)
      const verbatim = literals.filter(s => s !== undefined && ours.includes(s))

      expect(verbatim, `verbatim upstream copy in ${f}: ${verbatim.join(' || ')}`).toEqual([])
    }
  })

  it('pool-swap URL hook is purged', () => {
    expect(existsSync(resolve(ROOT, 'packages/lib/modules/swap/useIsPoolSwapUrl.tsx'))).toBe(false)
  })

  it('chains: Base mainnet + Base Sepolia only', () => {
    const block = config.split('supportedNetworks: [')[1]?.split('],')[0] ?? ''
    expect(block).toContain('GqlChainValues.Base')
    expect(block).toContain('Sepolia')

    for (const banned of [
      'Mainnet',
      'Arbitrum',
      'Gnosis',
      'Polygon',
      'Avalanche',
      'Optimism',
      'Monad',
      'Plasma',
      'Hyperevm',
    ]) {
      expect(block).not.toContain(banned)
    }

    expect(config).toContain('defaultNetwork: GqlChainValues.Base,')
  })

  it('pools-page explainer: promoItems required (Boss 2026-09-30), partner cards banned', () => {
    // S109 (Boss live E2E walk 2026-09-30): the pools page showed an EMPTY
    // explainer band where upstream's 4 expandables render. Boss directive:
    // reuse the pattern, our copy — 4 ROOTSTOCK cards. Supersedes the old
    // 'no promoItems' law (S99-era upstream-fingerprint ban).
    expect(config).toContain('promoItems: [')
    expect(config).not.toContain('partnerCards')
  })

  it('pools/portfolio surfaces RESTORED (Boss 2026-09-22): no redirects kill them; /vebal stays dead; no external destinations', () => {
    expect(nextConfig).not.toContain("source: '/pools',")
    expect(nextConfig).not.toContain("source: '/portfolio',")
    expect(nextConfig).toContain("source: '/vebal',")
    expect(nextConfig).not.toContain('legacy.balancer.fi')
    expect(nextConfig).not.toContain('terminal.basednut.com')
  })

  it('sitemap is ours only', () => {
    expect(sitemap).not.toContain('balancer.fi')
    // S107: fabricated URL banned; sitemap env-gated, empty in export
    expect(sitemap).not.toContain('rootstock.basednut.com')
    expect(sitemap).toContain('NEXT_PUBLIC_SITE_URL')
  })

  it('safe app link uses our project URL', () => {
    expect(safeHooks).not.toContain('projectId}.fi')
    expect(safeHooks).toContain('projectUrl')
  })
})
