import { describe, expect, it } from 'vitest'
import { ProjectConfigBalancer } from './balancer'
import { toApiNetworks, isOnchainOnlyNetwork } from '../getProjectConfig'

// Rootstock law: Base Sepolia (our deployment) is selectable in-app but must
// never be sent to the remote Balancer API as a query variable.
describe('onchain-only networks', () => {
  it('declares Base Sepolia as onchain-only', () => {
    expect(ProjectConfigBalancer.onchainOnlyNetworks).toContain('BASESEP')
    expect(isOnchainOnlyNetwork('BASESEP')).toBe(true)
    expect(isOnchainOnlyNetwork('BASE')).toBe(false)
  })

  it('filters onchain-only networks out of API chain lists', () => {
    const chains = [...ProjectConfigBalancer.supportedNetworks]
    expect(chains).toContain('BASESEP')
    const api = toApiNetworks(chains)
    expect(api).not.toContain('BASESEP')
    expect(api).toContain('BASE')
    expect(api.length).toBeGreaterThan(0)
  })

  it('dev networks are Base + Base Sepolia only (chains law)', () => {
    const dev = ProjectConfigBalancer.supportedNetworks
    expect(dev).toContain('BASE')
    expect(dev).toContain('BASESEP')
    expect(dev).not.toContain('SEPOLIA')
    expect(dev).not.toContain('ARBITRUM')
    expect(dev).not.toContain('OPTIMISM')
  })
})
