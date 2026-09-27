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
    expect(robots).toContain('rootstock.basednut.com/sitemap.xml')
  })

  it('sitemap.ts: covers core product routes', () => {
    // loop form: ROUTES array mapped over `${base}${route}`
    expect(sitemap).toContain('`${base}${route}`')

    for (const route of ['/swap', '/create', '/pools', '/portfolio', '/nutusd', '/lbp/create']) {
      expect(sitemap).toContain(`{ route: '${route}'`)
    }
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
    expect(robotsTxt).toContain('rootstock.basednut.com')
  })

  it.skipIf(!hasOut)('export out/: sitemap.xml covers core routes', () => {
    const sitemapXml = readFileSync(resolve(OUT, 'sitemap.xml'), 'utf8')

    for (const route of ['/swap', '/create', '/pools', '/portfolio', '/nutusd', '/lbp/create']) {
      expect(sitemapXml).toContain(route)
    }
  })
})
