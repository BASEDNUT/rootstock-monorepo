import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// S102 export laws (Boss 2026-09-26: boat integrity — no leaks, inspection-pass)
// The export is the ship: dev/demo surfaces and upstream references must
// never bake into out/. Source laws run always; built-artifact laws run
// whenever out/ exists (skip only pre-build).

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../')
const APP = resolve(ROOT, 'apps/frontend-v3')
const LIB = resolve(ROOT, 'packages/lib')

const buildScript = readFileSync(resolve(APP, 'scripts/build-ipfs.sh'), 'utf8')
const robots = readFileSync(resolve(APP, 'app/robots.ts'), 'utf8')
const sitemap = readFileSync(resolve(APP, 'app/sitemap.ts'), 'utf8')

// Dev/demo surfaces that must be moved aside during export (S102 law).
// debug/ = 12 demo pages incl wallet-impersonate; testooors/ = test page;
// vebal/ = upstream governance (targets upstream MAINNET contracts);
// pools/cow/ = upstream CoW orphan; components/ = Chakra showcase.
const DEV_SURFACES = [
  "'app/(app)/debug'",
  "'app/(app)/testooors'",
  "'app/(app)/vebal'",
  "'app/(app)/pools/cow'",
  "'app/(marketing)/components'",
]

describe('export laws — S102 boat integrity', () => {
  it('build-ipfs.sh declares and moves aside every dev surface', () => {
    for (const s of DEV_SURFACES) {
      expect(buildScript).toContain(s)
    }
  })

  it('build-ipfs.sh restores dev surfaces after build (reversible stash)', () => {
    expect(buildScript).toContain('dev surfaces restored')
  })

  it('robots.ts: zero upstream balancer.fi references; own sitemap', () => {
    expect(robots).not.toContain('balancer.fi')
    // S107: rootstock.basednut.com does not exist — fabricated URL, banned
    expect(robots).not.toContain('rootstock.basednut.com')
    expect(robots).not.toContain('balancer.fi')
  })

  it('sitemap.ts: covers core product routes', () => {
    // loop form: ROUTES array mapped over `${base}${route}`
    expect(sitemap).toContain('`${base}${route}`')

    for (const route of [
      '/swap',
      '/create',
      '/pools',
      '/portfolio',
      '/nutusd',
      '/lbp/create',
      '/mint',
      '/wrap',
    ]) {
      expect(sitemap).toContain(`'${route}'`)
    }
  })

  it('sitemap.ts + robots.ts: declare force-static (output:export law)', () => {
    // S100 export law, dropped by the S107 env-gated rewrite — main was never
    // export-built before S108, so the regression shipped unnoticed. Static
    // export requires force-static on metadata routes.
    expect(sitemap).toContain("export const dynamic = 'force-static'")
    expect(robots).toContain("export const dynamic = 'force-static'")
  })

  const OUT = resolve(APP, 'out')
  const hasOut = existsSync(resolve(OUT, 'index.html'))

  it.skipIf(!hasOut)('export out/: zero dev-surface routes baked', () => {
    const baked = ['debug', 'testooors', 'vebal', 'pools/cow', 'components']

    for (const d of baked) {
      expect(existsSync(resolve(OUT, d))).toBe(false)
    }
  })

  it.skipIf(!hasOut)('export out/: robots.txt has no upstream sitemap', () => {
    const robotsTxt = readFileSync(resolve(OUT, 'robots.txt'), 'utf8')
    expect(robotsTxt).not.toContain('balancer.fi')
    expect(robotsTxt).not.toContain('rootstock.basednut.com')
  })

  // ─── S109 laws (Boss live E2E walk 2026-09-30) ────────────────────────────

  it('S109: AcceptPoliciesModal entity is project-native (no upstream orgs)', () => {
    const modal = readFileSync(resolve(LIB, 'modules/web3/AcceptPoliciesModal.tsx'), 'utf8')
    expect(modal).not.toContain('BeethovenX DAO')
    expect(modal).not.toContain('Balancer Foundation')
    expect(modal).toContain('entityName = projectName')
  })

  it('S109: claim tabs are our chains only (Base + Base Sepolia)', () => {
    const claim = readFileSync(
      resolve(LIB, 'modules/portfolio/PortfolioClaim/ClaimNetworkPools/ClaimNetworkPools.tsx'),
      'utf8'
    )

    expect(claim).not.toContain("{ chain: GqlChainValues.Mainnet, name: 'Ethereum'")
    expect(claim).not.toContain('{ chain: GqlChainValues.Arbitrum')
    expect(claim).toContain("{ chain: GqlChainValues.Base, name: 'Base'")
    expect(claim).toContain('GqlChainValues.BaseSepolia')
  })

  it('S109: ChainConfig export-mode public RPCs (no dead /api/rpc proxy on the ship)', () => {
    const cfg = readFileSync(resolve(LIB, 'modules/web3/ChainConfig.tsx'), 'utf8')
    expect(cfg).toContain('NEXT_PUBLIC_IPFS_EXPORT')
    expect(cfg).toContain('base.publicnode.com')
    expect(cfg).toContain('sepolia.base.org')
    expect(cfg).not.toContain("[GqlChainValues.Base]: 'https://1rpc.io/base'")
  })

  it('S109: our chains swap onchain — never the upstream API SOR (upstream pool routing killed live swaps)', () => {
    const sp = readFileSync(resolve(LIB, 'modules/swap/SwapProvider.tsx'), 'utf8')
    expect(sp).toContain('chain === GqlChainValues.Base')
    const h = readFileSync(resolve(LIB, 'modules/swap/handlers/OnchainSwap.handler.ts'), 'utf8')
    expect(h).toContain('8453')
    expect(h).toContain('chain: GqlChain')
  })

  it('S109: export build rewrites next/link imports to the IpfsLink full-page anchor', () => {
    // turbopack resolveAlias for the next-internal 'next/link' module fails
    // silently (verified S109: zero data-ipfs-link baked, both relative and
    // absolute forms) — the deterministic mechanism is a build-time import
    // rewrite in build-ipfs.sh (flat stash + manifest, trap-restored).
    expect(buildScript).toContain('rewrite_link_imports')
    expect(buildScript).toContain('restore_link_imports')
    expect(buildScript).toContain("from 'next/link'")
    expect(buildScript).toContain('@repo/lib/shared/components/ipfs/IpfsLink')
    const ipfsLink = readFileSync(resolve(LIB, 'shared/components/ipfs/IpfsLink.tsx'), 'utf8')
    expect(ipfsLink).toContain('<a')
    expect(ipfsLink).toContain('data-ipfs-link')
  })

  it('S109: router.push sites route through navTo (full-page on the ship)', () => {
    const nav = readFileSync(resolve(LIB, 'shared/utils/ipfs-nav.ts'), 'utf8')
    expect(nav).toContain('window.location.assign')
    const poolUtils = readFileSync(resolve(LIB, 'modules/pool/pool.utils.ts'), 'utf8')
    expect(poolUtils).toContain('navTo(router,')
  })

  it('S110: mint/wrap — global chain picker, honest Base gating (replaces static badge)', () => {
    for (const p of ['mint', 'wrap']) {
      const src = readFileSync(resolve(APP, `app/(app)/${p}/page.tsx`), 'utf8')
      // S110 (Boss 2026-09-30): two chains for everything — the page carries
      // the global picker, not a static chain badge.
      expect(src).toContain('<ChainSelect')
      expect(src).toContain('setRootstockChain')
      // honest Base state: factories are NOT deployed on Base mainnet yet
      expect(src).toContain('deploys with the Rootstock mainnet release')
      expect(src).not.toContain('<NetworkIcon chain={GqlChainValues.BaseSepolia} size={7}')
    }
  })

  it('S109: pools page explainer — 4 ROOTSTOCK promo cards configured', () => {
    const proj = readFileSync(resolve(LIB, 'config/projects/balancer.ts'), 'utf8')
    expect(proj).toContain('promoItems: [')

    for (const t of [
      'Weighted pools',
      'Stable pools',
      'reCLAMM pools',
      'Liquidity Bootstrapping',
    ]) {
      expect(proj).toContain(t)
    }
  })

  it('S109: build-ipfs.sh bakes the export flag and trap-restores stashes', () => {
    expect(buildScript).toContain('NEXT_PUBLIC_IPFS_EXPORT=1')
    expect(buildScript).toContain('trap ')
  })

  it.skipIf(!hasOut)(
    'S109 export out/: IpfsLink baked into JS chunks (full-page anchors on the ship)',
    () => {
      // The nav is hydration-gated (suspense boundaries prerender empty) —
      // anchors appear client-side, so the alias proof lives in the BUNDLED
      // CHUNKS, not the static HTML. Zero data-ipfs-link in chunks = the
      // alias silently failed (verified S109: relative-path form).
      const chunksDir = resolve(OUT, '_next/static/chunks')
      const files = readdirSync(chunksDir).filter(f => f.endsWith('.js'))

      const baked = files.some(f =>
        readFileSync(resolve(chunksDir, f), 'utf8').includes('data-ipfs-link')
      )

      expect(files.length).toBeGreaterThan(0)
      expect(baked).toBe(true)
    }
  )

  // ─── S110 laws (Boss live verdict 2026-09-30: swap page crash + two chains everywhere) ──

  it('S110: OnchainSwapHandler ctor never throws (Base page-crash fix)', () => {
    const h = readFileSync(resolve(LIB, 'modules/swap/handlers/OnchainSwap.handler.ts'), 'utf8')
    const ctorStart = h.indexOf('constructor(')
    const ctorEnd = h.indexOf('private async getPools')
    expect(ctorStart).toBeGreaterThan(-1)
    expect(ctorEnd).toBeGreaterThan(ctorStart)
    const ctor = h.slice(ctorStart, ctorEnd)
    expect(ctor).not.toContain('throw')
    // honest no-pools at action time, never at render
    expect(h).toContain('if (!this.scanConfig) return []')
  })

  it('S110: global persistent chain selection — one pick, every surface', () => {
    const g = readFileSync(resolve(LIB, 'shared/hooks/useRootstockChain.ts'), 'utf8')
    expect(g).toContain("'rootstock.selectedChain'")
    expect(g).toContain('makeVar')
    expect(g).toContain('localStorage')

    for (const f of [
      'modules/swap/SwapProvider.tsx',
      'modules/lbp/steps/SaleStructureStep.tsx',
      'modules/pool/actions/create/steps/type/ChooseNetwork.tsx',
    ]) {
      expect(readFileSync(resolve(LIB, f), 'utf8')).toContain('setRootstockChain')
    }
  })

  it('S110: supportedNetworks = Base + Base Sepolia unconditionally (two chains for everything)', () => {
    const cfg = readFileSync(resolve(LIB, 'config/projects/balancer.ts'), 'utf8')
    expect(cfg).toContain('supportedNetworks: [GqlChainValues.Base, GqlChainValues.BaseSepolia]')
    expect(cfg).not.toContain('...(isProd ? [] : [GqlChainValues.BaseSepolia])')
  })

  it.skipIf(!hasOut)('export out/: sitemap.xml env-gated, zero fabricated hosts', () => {
    const sitemapXml = readFileSync(resolve(OUT, 'sitemap.xml'), 'utf8')

    // S107 design + S108 reconciliation: no DNS host exists — no
    // NEXT_PUBLIC_SITE_URL at build time → empty urlset. Route coverage is
    // enforced at the source level above. No fabricated hosts, ever.
    for (const banned of ['balancer.fi', 'rootstock.basednut.com']) {
      expect(sitemapXml).not.toContain(banned)
    }

    const locs = (sitemapXml.match(/<loc>/g) ?? []).length
    expect(locs).toBe(0)
  })
})
