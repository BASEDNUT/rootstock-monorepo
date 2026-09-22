import { describe, expect, it } from 'vitest'
import { getOnchainOnlyTokens } from './onchain-tokens'
import { ProjectConfigBalancer } from '@repo/lib/config/projects/balancer'

// Rootstock law: onchain-only networks get local token metadata synthesized
// from NetworkConfig — never from the remote API.
describe('getOnchainOnlyTokens', () => {
  it('synthesizes ETH + WETH for Base Sepolia', () => {
    const tokens = getOnchainOnlyTokens()
    const baseSep = tokens.filter(t => t.chain === 'BASESEP')
    expect(baseSep.length).toBe(2)

    const eth = baseSep.find(t => t.symbol === 'ETH')
    const weth = baseSep.find(t => t.symbol === 'WETH')
    expect(eth?.address).toBe('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
    expect(eth?.chainId).toBe(84532)
    expect(weth?.address).toBe('0x4200000000000000000000000000000000000006')
    expect(weth?.name).toBe('Wrapped Ether')
    expect(weth?.decimals).toBe(18)
    expect(weth?.tradable).toBe(true)
    expect(weth?.priceRateProviderData).toBeNull()
  })

  it('covers every declared onchain-only network', () => {
    const declared = ProjectConfigBalancer.onchainOnlyNetworks || []
    const chains = new Set(getOnchainOnlyTokens().map(t => t.chain))
    for (const chain of declared) {
      expect(chains.has(chain)).toBe(true)
    }
  })

  it('produces no tokens for API-served chains', () => {
    const tokens = getOnchainOnlyTokens()
    expect(tokens.find(t => t.chain === 'BASE')).toBeUndefined()
    expect(tokens.find(t => t.chain === 'SEPOLIA')).toBeUndefined()
  })
})
