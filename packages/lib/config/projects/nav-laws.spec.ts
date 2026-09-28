import { describe, it, expect } from 'vitest'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

/**
 * S106 Boss nav laws v2 (2026-09-28) — progressive disclosure order:
 * - Law 1: exactly ONE Swap link (S100b — stands).
 * - Law 1b: no duplicate hrefs (S100b — stands).
 * - Law 2: ORDER law — journey = possess → observe → trade → create → launch:
 *   Portfolio, Pools, Swap, Mint token, Wrap token, Create pool, Launch.
 *   Old 'Create pool = 2nd item' (S100c) SUPERSEDED by this order (Boss GO).
 * - Law 3: Ecosystem = everything OUTSIDE the site — every link external,
 *   no internal routes, no '#' placeholders. nutUSD now LIVES here (external
 *   Morpho curator link) — it is a Base-mainnet lending vault, outside the
 *   AMM stack. The /nutusd internal page stays alive for deep links only.
 * - Law 4: LBP is jargon — the link label reads 'Launch' (href unchanged).
 */
describe('Nav laws (Boss 2026-09-24, order v2 2026-09-28)', () => {
  const appLinks = PROJECT_CONFIG.links.appLinks

  it('Law 1: exactly one Swap link in the top-menu app links', () => {
    const swapLinks = appLinks.filter(l => (l.href || '').startsWith('/swap'))
    expect(swapLinks.length).toBe(1)
  })

  it('Law 1b: no duplicate hrefs in the top-menu app links', () => {
    const hrefs = appLinks.map(l => l.href).filter(Boolean) as string[]
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('Law 2: journey order — Portfolio, Pools, Swap, Create pool, Mint, Wrap, Launchpad (Boss GO 2026-09-28)', () => {
    const expected = ['/portfolio', '/pools', '/swap', '/create', '/mint', '/wrap', '/lbp/create']
    const hrefs = appLinks.map(l => l.href).filter(Boolean) as string[]

    // every expected link present
    for (const href of expected) {
      expect(hrefs, `top menu must contain ${href}`).toContain(href)
    }

    // and in the exact journey order (relative order check)
    const positions = expected.map(h => hrefs.indexOf(h))

    for (let i = 1; i < positions.length; i++) {
      expect(
        positions[i]!,
        `progressive-disclosure order broken at index ${i}: ${expected[i]} must come after ${expected[i - 1]}`
      ).toBeGreaterThan(positions[i - 1]!)
    }

    // no extra links beyond the journey
    expect(hrefs).toHaveLength(expected.length)
  })

  it('Law 3: ecosystem links are external OR internal doorways to our ecosystem pages (Boss 2026-09-28)', () => {
    for (const l of PROJECT_CONFIG.links.ecosystemLinks) {
      // Doorway: internal route to OUR page that itself links outside
      // (e.g. /nutusd carries the real app.morpho.org vault link).
      // External: anything outside the site. '#' placeholders banned always.
      expect(l.href, `ecosystem link "${l.label}" must not be a # placeholder`).not.toBe('#')

      if (!l.isExternal) {
        expect(
          (l.href || '').startsWith('/'),
          `internal ecosystem link "${l.label}" must be an in-app route`
        ).toBe(true)
      }
    }
  })

  it('Law 3b: nutUSD lives in ecosystem as the /nutusd DOORWAY (internal) — not in the top menu', () => {
    // demoted: no top-menu entry
    expect(
      appLinks.some(l => (l.href || '').startsWith('/nutusd')),
      'nutUSD is outside the AMM stack — must NOT be a top-menu app link'
    ).toBe(false)

    // lives in ecosystem as OUR page (the doorway); the page itself carries
    // the real user vault link (app.morpho.org) — never link the outside
    // source directly from the menu (Boss order 2026-09-28).
    const nut = PROJECT_CONFIG.links.ecosystemLinks.find(l => /nutusd/i.test(l.label || ''))
    expect(nut, 'ecosystem must carry a nutUSD entry').toBeDefined()
    expect(nut!.href).toBe('/nutusd')
    expect(nut!.isExternal).toBeFalsy()
  })

  it('Law 4: LBP link is labeled Launchpad (href unchanged)', () => {
    const lbp = appLinks.find(l => l.href === '/lbp/create')
    expect(lbp, 'Launchpad (/lbp/create) must be a top-menu link').toBeDefined()
    expect(lbp!.label).toBe('Launchpad')
  })
})
