import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../')
const read = (f: string) => readFileSync(`${HERE}/${f}`, 'utf8')

const hero = read('Hero.tsx')
const code = read('Code.tsx')
const contracts = read('Contracts.tsx')
const features = read('Features.tsx')
const grow = read('Grow.tsx')
const videos = read('Videos.tsx')
const audits = read('Audits.tsx')
const landingSurface = [hero, code, contracts, features, grow, videos, audits].join('')

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
const swapModal = readFileSync(
  resolve(ROOT, 'packages/lib/modules/swap/modal/SwapModal.tsx'),
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
].join('')

describe('homepage laws v6 — IPFS interaction scope', () => {
  it('zero Balancer anywhere on homepage surfaces', () => {
    for (const surface of [
      landingSurface,
      buildPromo,
      useNav,
      navBar,
      buildPopover,
      mobileBuildAccordion,
      marketingLayout,
    ]) {
      expect(surface.match(/balancer/gi)).toBeNull()
    }
  })

  it('zero v3 strings on homepage surfaces', () => {
    for (const surface of [landingSurface, marketingLayout]) {
      expect(surface.match(/v3/gi)).toBeNull()
    }
  })

  it('no NUT/wNUT/orchard/graft tokens on homepage surfaces', () => {
    for (const banned of [/\bwNUT\b/, /\bNUT\b/, /\borchard\b/i, /\bgraft\b/i]) {
      expect(landingSurface.match(banned)).toBeNull()
    }
  })

  it('no external balancer links (youtube videos allowed)', () => {
    for (const banned of [
      'docs.balancer.fi',
      'github.com/balancer',
      'balancer.fi',
      'dune.com/balancer',
      'immunefi.com/bug-bounty/balancer',
    ]) {
      expect(landingAll).not.toContain(banned)
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

  it('stats section is static design principles, no changing data', () => {
    expect(grow).toContain('Designed as one piece')
    expect(grow).toContain("stat: '01'")
    expect(grow).toContain("stat: '04'")
    for (const banned of ['Contracts live', 'testnet', 'deployment', 'engine today']) {
      expect(grow).not.toContain(banned)
    }
  })

  it('pool-swap URL hook is purged', () => {
    expect(
      existsSync(resolve(ROOT, 'packages/lib/modules/swap/useIsPoolSwapUrl.tsx'))
    ).toBe(false)
    expect(swapModal).not.toContain('isPoolSwapUrl')
  })

  it('chains: Base mainnet + Base Sepolia only', () => {
    expect(config).toContain('supportedNetworks: [')
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

  it('redirects: /pools, /portfolio, /vebal -> terminal; no legacy balancer redirects', () => {
    expect(nextConfig).toContain("source: '/pools',")
    expect(nextConfig).toContain('https://terminal.basednut.com')
    expect(nextConfig).not.toContain('legacy.balancer.fi')
    expect(nextConfig).toContain("source: '/portfolio',")
    expect(nextConfig).toContain("source: '/vebal',")
  })

  it('sitemap is ours only', () => {
    expect(sitemap).not.toContain('balancer.fi')
    expect(sitemap).toContain('rootstock.basednut.com')
  })

  it('safe app link uses our project URL', () => {
    expect(safeHooks).not.toContain('projectId}.fi')
    expect(safeHooks).toContain('projectUrl')
  })

  it('audits lineage: zero Balancer mention', () => {
    expect(audits.match(/balancer/gi)).toBeNull()
  })
})
