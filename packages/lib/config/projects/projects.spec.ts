import { describe, expect, it } from 'vitest'
import { ProjectConfigBalancer } from './balancer'

describe('project config', () => {
  it('is structurally complete', () => {
    expect(ProjectConfigBalancer.projectId).toBeTypeOf('string')
    expect(ProjectConfigBalancer.projectName).toBeTypeOf('string')
    expect(ProjectConfigBalancer.projectUrl).toMatch(/^https:\/\//)
    expect(ProjectConfigBalancer.projectLogo).toBeTypeOf('string')
    expect(ProjectConfigBalancer.supportedNetworks.length).toBeGreaterThan(0)
    expect(ProjectConfigBalancer.defaultNetwork).toBeTypeOf('string')
    expect(ProjectConfigBalancer.ensNetwork).toBeTypeOf('string')
    expect(ProjectConfigBalancer.options).toBeDefined()
    expect(ProjectConfigBalancer.links).toBeDefined()
    expect(ProjectConfigBalancer.footer.linkSections.length).toBeGreaterThan(0)
  })

  it('lists only Base and Sepolia (dev)', () => {
    expect(ProjectConfigBalancer.supportedNetworks).toContain('BASE')
    expect(ProjectConfigBalancer.defaultNetwork).toBe('BASE')
  })
})
