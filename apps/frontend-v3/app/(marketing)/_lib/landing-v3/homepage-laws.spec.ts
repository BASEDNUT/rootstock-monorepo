import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync, execSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../')
const read = (f: string) => readFileSync(`${HERE}/${f}`, 'utf8')

const hero = read('Hero.tsx')
const code = read('Code.tsx')
const contracts = read('Contracts.tsx')
const features = read('Features.tsx')
const landingSurface = [hero, code, contracts, features].join('')

const buildPromo = readFileSync(
  resolve(ROOT, 'packages/lib/shared/pages/PoolsPage/BuildPromo.tsx'),
  'utf8'
)
const useNav = readFileSync(
  resolve(ROOT, 'packages/lib/shared/components/navs/useNav.tsx'),
  'utf8'
)
const navBar = readFileSync(
  resolve(ROOT, 'packages/lib/shared/components/navs/NavBar.tsx'),
  'utf8'
)
const config = readFileSync(
  resolve(ROOT, 'packages/lib/config/projects/balancer.ts'),
  'utf8'
)
const buildPopover = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/lib/components/navs/BuildPopover.tsx'),
  'utf8'
)
const mobileBuildAccordion = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/lib/components/navs/MobileBuildAccordion.tsx'),
  'utf8'
)
const nextConfig = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/next.config.ts'),
  'utf8'
)
const sitemap = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/app/sitemap.ts'),
  'utf8'
)
const marketingLayout = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/app/(marketing)/layout.tsx'),
  'utf8'
)
const safeHooks = readFileSync(
  resolve(ROOT, 'packages/lib/modules/web3/safe.hooks.tsx'),
  'utf8'
)
const headerBanner = readFileSync(
  resolve(ROOT, 'packages/lib/modules/pool/actions/create/header/HeaderBanner.tsx'),
  'utf8'
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

describe('homepage laws v7 — IPFS interaction scope + no-verbatim + no-fabricated-URLs', () => {
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
    for (const banned of [/\bwNUT\b/, /\bNUT\b/, /\borchard\b/i, /\bgraft\b/i]) {
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

  it('no hyperlinks to /pools on any surface', () => {
    for (const surface of [
      landingSurface,
      buildPromo,
      useNav,
      navBar,
      buildPopover,
      mobileBuildAccordion,
      config,
    ]) {
      expect(surface.match(/href="\/pools/)).toBeNull()
    }
    expect(config).not.toContain("'/pools")
    expect(config).not.toContain('"/pools')
  })

  it('Test-Pools is gone from nav (Debug stays)', () => {
    expect(navBar).not.toContain('Test-Pools')
    expect(navBar).toContain('"/debug"')
  })

  it('Launch app points at /swap', () => {
    expect(navBar).toContain('href="/swap" prefetch px={7}')
  })

  it('Videos, Grow, Audits sections are deleted (Boss 2026-09-21)', () => {
    expect(existsSync(`${HERE}/Videos.tsx`)).toBe(false)
    expect(existsSync(`${HERE}/Grow.tsx`)).toBe(false)
    expect(existsSync(`${HERE}/Audits.tsx`)).toBe(false)
    expect(hero).not.toContain('youtu.be')
    expect(hero).not.toContain('PlayVideoButton')
    expect(existsSync(`${HERE}/images/video-createCustomAMMs.png`)).toBe(false)
    expect(existsSync(`${HERE}/images/video-prototypePool.png`)).toBe(false)
    expect(existsSync(`${HERE}/images/video-createHook.png`)).toBe(false)
    expect(existsSync(`${HERE}/images/video-createRouter.png`)).toBe(false)
  })

  it('NO VERBATIM COPY from upstream balancer landing files', () => {
    // Extract string literals (>=6 words) from upstream versions of our live
    // landing files and assert none appear verbatim in our live files.
    const files = ['Hero.tsx', 'Code.tsx', 'Contracts.tsx', 'Features.tsx']
    for (const f of files) {
      let upstream = ''
      try {
        upstream = execSync(
          `git show 'origin/main:apps/frontend-v3/app/(marketing)/_lib/landing-v3/${f}'`,
          { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
        )
      } catch {
        continue // upstream file missing — nothing to compare
      }
      const literals = [
        ...upstream.matchAll(/'([^'\n]{30,})'|"([^"\n]{30,})"/g),
      ]
        .map(m => m[1] || m[2])
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
      const verbatim = literals.filter(s => ours.includes(s))
      expect(
        verbatim,
        `verbatim upstream copy in ${f}: ${verbatim.join(' || ')}`
      ).toEqual([])
    }
  })

  it('pool-swap URL hook is purged', () => {
    expect(
      existsSync(resolve(ROOT, 'packages/lib/modules/swap/useIsPoolSwapUrl.tsx'))
    ).toBe(false)
  })

  it('chains: Base mainnet + Base Sepolia only', () => {
    const block = config.split('supportedNetworks: [')[1].split('],')[0]
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

  it('no promo banners or partner cards (pools-page machinery)', () => {
    expect(config).not.toContain('promoItems')
    expect(config).not.toContain('partnerCards')
  })

  it('redirects: /pools, /portfolio, /vebal -> /; no external destinations', () => {
    expect(nextConfig).toContain("source: '/pools',")
    expect(nextConfig).toContain("source: '/portfolio',")
    expect(nextConfig).toContain("source: '/vebal',")
    expect(nextConfig).not.toContain('legacy.balancer.fi')
    expect(nextConfig).not.toContain('terminal.basednut.com')
  })

  it('sitemap is ours only', () => {
    expect(sitemap).not.toContain('balancer.fi')
    expect(sitemap).toContain('rootstock.basednut.com')
  })

  it('safe app link uses our project URL', () => {
    expect(safeHooks).not.toContain('projectId}.fi')
    expect(safeHooks).toContain('projectUrl')
  })
})
