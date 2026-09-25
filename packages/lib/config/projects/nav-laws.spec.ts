import { describe, it, expect } from 'vitest'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'

/**
 * S100b Boss nav laws (2026-09-24):
 * - Law 1: exactly ONE Swap item in the top nav (duplicate shipped — Boss
 *   caught it; agent had never enumerated the merged nav).
 * - Law 2: pool creation (/create) is a TOP-MENU app link — never hidden
 *   under Ecosystem. Pool creation happens INSIDE the site.
 * - Law 3: Ecosystem = everything OUTSIDE the IPFS site. Every ecosystem
 *   link must be external. No internal routes, no '#' placeholders.
 */
describe('Nav laws (Boss 2026-09-24)', () => {
  const appLinks = PROJECT_CONFIG.links.appLinks

  it('Law 1: exactly one Swap link in the top-menu app links', () => {
    const swapLinks = appLinks.filter(l => (l.href || '').startsWith('/swap'))
    expect(swapLinks.length).toBe(1)
  })

  it('Law 1b: no duplicate hrefs in the top-menu app links', () => {
    const hrefs = appLinks.map(l => l.href).filter(Boolean) as string[]
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('Law 2: pool creation is a top-menu app link (/create)', () => {
    expect(appLinks.some(l => l.href === '/create')).toBe(true)
  })

  it('Law 3: every ecosystem link is external (outside the site)', () => {
    for (const l of PROJECT_CONFIG.links.ecosystemLinks) {
      expect(l.isExternal, `ecosystem link "${l.label}" must be external`).toBe(true)

      expect(
        (l.href || '').startsWith('/'),
        `ecosystem link "${l.label}" must not be internal`
      ).toBe(false)

      expect(l.href, `ecosystem link "${l.label}" must not be a # placeholder`).not.toBe('#')
    }
  })
})
