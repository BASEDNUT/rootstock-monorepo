import { describe, expect, it } from 'vitest'
import { colors } from './colors'
import { balTheme } from './bal.theme'
import { ProjectConfigBalancer } from '@repo/lib/config/projects/balancer'

function hueOf(hexInput?: string) {
  const hex = String(hexInput)
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let hue = 0
  if (max === r) hue = ((g - b) / d) % 6
  else if (max === g) hue = (b - r) / d + 2
  else hue = (r - g) / d + 4
  return Math.round(((hue * 60) + 360) % 360)
}

describe('BASED NUT brand pass', () => {
  it('swaps the violet identity ramp for peanut caramel (hue 25-45)', () => {
    expect(colors.purple['500']).not.toBe('#7f6ae8')
    expect(hueOf(String(colors.purple['500']))).toBeGreaterThanOrEqual(25)
    expect(hueOf(String(colors.purple['500']))).toBeLessThanOrEqual(45)
    expect(hueOf(String(colors.purple['300']))).toBeGreaterThanOrEqual(25)
    expect(hueOf(String(colors.purple['300']))).toBeLessThanOrEqual(45)
  })

  it('warm-shifts the dark base background (hue ~26, not cool slate)', () => {
    const hue = parseInt(String(colors.base.hslDark).split(',')[0] ?? '', 10)
    expect(hue).toBeGreaterThanOrEqual(15)
    expect(hue).toBeLessThanOrEqual(45)
  })

  it('replaces dawn gradients with honey stops (no violet hues)', () => {
    expect(colors.gradient.dawnDark).not.toContain('hsla(244')
    expect(colors.gradient.dawnDark).not.toContain('hsla(266')
    expect(colors.gradient.dawnLight).not.toContain('hsla(245')
    expect(colors.gradient.dawnLight).not.toContain('hsla(266')
    expect(colors.gradient.special).not.toContain('179,174,245')
  })

  it('warm-shifts the dark elevation ladder while keeping the level structure', () => {
    const bg = balTheme.semanticTokens.colors.background as unknown as Record<string, string>
    expect(String(bg.level0).toLowerCase()).toBe('#3f3731')
    expect(String(bg.level1).toLowerCase()).toBe('#473e38')
    expect(String(bg.level2).toLowerCase()).toBe('#50463f')
    expect(String(bg.level3).toLowerCase()).toBe('#584e46')
    expect(String(bg.level4).toLowerCase()).toBe('#61554c')
  })

  it('gives primary buttons a honey glow instead of violet', () => {
    const primary = (balTheme.components as any).Button.variants.primary
    expect(primary.boxShadow).not.toContain('hsla(245')
    expect(primary._hover.boxShadow).not.toContain('hsla(9')
  })

  it('brands the project config as BASED NUT with the nut mark', () => {
    expect(ProjectConfigBalancer.projectName).toBe('ROOTSTOCK')
    expect(ProjectConfigBalancer.projectLogo).toBe('/images/icons/nut.svg')
  })
})
