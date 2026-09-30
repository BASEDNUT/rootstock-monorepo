import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// S102 export laws (Boss 2026-09-26: boat integrity — no leaks, inspection-pass)
// The export is the ship: dev/demo surfaces and upstream references must
// never bake into out/. Source laws run always; built-artifact laws run
// whenever out/ exists (skip only pre-build).

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../')
const APP = resolve(ROOT, 'apps/frontend-v3')

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
