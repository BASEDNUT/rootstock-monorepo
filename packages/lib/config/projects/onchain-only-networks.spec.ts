import { describe, expect, it } from 'vitest'
import { ProjectConfigBalancer } from './balancer'
import { toApiNetworks, isOnchainOnlyNetwork } from '../getProjectConfig'

// Rootstock law (S113d 2026-10-03): BOTH our chains are live deployments —
// Base mainnet (S113c) + Base Sepolia (S95). Both are selectable in-app but
// must never be sent to the remote Balancer API as query variables; their
// pools come from onchain discovery only.
describe('onchain-only networks', () => {
  it('declares both Rootstock chains (BASE + BASESEP) as onchain-only', () => {
    expect(ProjectConfigBalancer.onchainOnlyNetworks).toContain('BASESEP')
    expect(ProjectConfigBalancer.onchainOnlyNetworks).toContain('BASE')
    expect(isOnchainOnlyNetwork('BASESEP')).toBe(true)
    expect(isOnchainOnlyNetwork('BASE')).toBe(true)
    expect(isOnchainOnlyNetwork('ARBITRUM')).toBe(false)
  })

  it('filters onchain-only networks out of API chain lists', () => {
    const chains = [...ProjectConfigBalancer.supportedNetworks]
    expect(chains).toContain('BASESEP')
    expect(chains).toContain('BASE')
    const api = toApiNetworks(chains)
    // BOTH supported networks are onchain-only — the API list is empty:
    // the upstream API is NEVER queried for any supported chain.
    expect(api).not.toContain('BASESEP')
    expect(api).not.toContain('BASE')
    expect(api.length).toBe(0)
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
