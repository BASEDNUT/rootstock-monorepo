import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
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
const buildPromo = readFileSync(
  resolve(ROOT, 'packages/lib/shared/pages/PoolsPage/BuildPromo.tsx'),
  'utf8'
)
const useNav = readFileSync(
  resolve(ROOT, 'packages/lib/shared/components/navs/useNav.tsx'),
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
const mobileAccordion = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/lib/components/navs/MobileBuildAccordion.tsx'),
  'utf8'
)
const nutusd = readFileSync(
  resolve(ROOT, 'apps/frontend-v3/app/(app)/nutusd/page.tsx'),
  'utf8'
)
const all = [hero, code, contracts, features, grow, videos, audits, buildPromo].join('\n')

const REPO = 'https://github.com/BASEDNUT/rootstock-monorepo'

describe('ROOTSTOCK homepage + scope laws (Boss-approved v5)', () => {
  it('hero: ROOTSTOCK eyebrow + Custom markets made simple H1 + both H2 lines', () => {
    expect(hero).toContain('ROOTSTOCK')
    expect(hero).toContain('Custom markets made simple')
    expect(hero).toContain('Swap, provide liquidity, or build markets')
    expect(hero).toContain('One engine for pools, hooks, and routing')
  })

  it('hero: no stone photo, soil background instead', () => {
    expect(hero).not.toContain('hero-bg-dark')
  })

  it('hero CTA points to swap (IPFS interaction surface)', () => {
    expect(hero).toContain('href="/swap"')
    expect(hero).not.toContain('href="/pools"')
  })

  it('zero NUT / wNUT / orchard / graft on the homepage', () => {
    for (const banned of ['NUT', 'wNUT', 'Orchard', 'orchard', 'graft', 'Graft']) {
      expect(all.includes(banned)).toBe(false)
    }
  })

  it('Balancer mentioned exactly once (audits lineage line)', () => {
    const count = (all.match(/Balancer/g) || []).length
    expect(count).toBe(1)
  })

  it('no balancer external links on homepage surfaces (youtube videos allowed)', () => {
    for (const banned of ['docs.balancer.fi', 'github.com/balancer', 'balancer.fi']) {
      expect(all.includes(banned)).toBe(false)
    }
  })

  it('nav: IPFS is interaction only — swap stays, pools/portfolio are gone', () => {
    expect(useNav).toContain("href: '/swap'")
    expect(useNav).not.toContain("href: '/pools'")
    expect(useNav).not.toContain("href: '/portfolio'")
  })

  it('nav: nutUSD replaces veBAL', () => {
    expect(config).toContain("{ href: '/nutusd', label: 'nutUSD' }")
    expect(config).not.toContain('veBAL')
  })

  it('config: all ecosystem/social/footer links are ours (no balancer URLs)', () => {
    for (const banned of ['balancer.fi', 'github.com/balancer', 'dune.com/balancer', 'immunefi.com/bug-bounty/balancer']) {
      expect(config.includes(banned)).toBe(false)
    }
    expect(config).toContain(REPO)
    expect(config).toContain('terminal.basednut.com')
    expect(config).toContain('orchard.basednut.com')
    expect(config).toContain('x.com/BASEDNUT_')
  })

  it('build popover + mobile accordion: no balancer links, ours only', () => {
    const popoverAll = buildPopover + mobileAccordion
    expect(popoverAll).not.toContain('balancer.fi')
    expect(popoverAll).not.toContain('github.com/balancer')
    expect(popoverAll).toContain(REPO)
  })

  it('nutUSD vault page exists with curator link', () => {
    expect(nutusd).toContain('0x846E88618A15766940277471509511bf69443CC1')
    expect(nutusd).toContain('curator.morpho.org/vaults/8453')
    expect(nutusd).not.toContain('veBAL')
  })

  it('build promo: data-layer link to terminal, no internal pools link', () => {
    expect(buildPromo).toContain('terminal.basednut.com')
    expect(buildPromo).not.toContain('href="/pools"')
  })

  it('stats section: architecture numbers only, no internal process metrics', () => {
    expect(grow).toContain('Pool families')
    expect(grow).toContain('Root Vault')
    expect(grow).toContain('Routers')
    expect(grow).toContain('65')
    expect(grow).not.toContain('3,233')
    expect(grow).not.toContain('Full lifecycle')
    expect(grow).not.toContain('Tests green')
  })

  it('videos: balancer-branded titles rewritten, youtube links kept', () => {
    expect(videos).not.toContain('Prototype v3 on Scaffold Balancer')
    expect(videos).not.toContain('Create a Hook on Balancer v3')
    expect(videos).not.toContain('Create a Router on Balancer v3')
    expect(videos).toContain('youtu.be')
  })

  it('audits: lineage + reports placeholder', () => {
    expect(audits).toContain('pristine copy')
    expect(audits).toContain('Rootstock audits (coming soon)')
  })

  it('create CTA present in BuildPromo', () => {
    expect(buildPromo).toContain('Build something new')
  })
})
