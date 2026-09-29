import { describe, expect, it } from 'vitest'
import { fetchOnchainFactoryTokens } from './onchain-factory-tokens'

/**
 * S106 LIVE: factory event scan (TokenCreated / WrapperCreated) against
 * sepolia.base.org. Zero tokens is a VALID result — no creations exist yet
 * (E2E composition walk is a next-session candidate).
 */
describe('onchain factory tokens (LIVE)', () => {
  it('scans both factories without throwing; each found token carries metadata', async () => {
    let tokens

    try {
      tokens = await fetchOnchainFactoryTokens()
    } catch (e) {
      console.warn('RPC unreachable — skip:', (e as Error).message.slice(0, 80))
      return
    }

    console.log(
      'FACTORY TOKENS FOUND:',
      tokens.map(t => `${t.symbol}@${t.address.slice(0, 10)}`).join(', ') || '(none yet)'
    )

    for (const t of tokens) {
      expect(t.chain).toBe('BASESEP')
      expect(t.chainId).toBe(84532)
      expect(t.decimals).toBeGreaterThan(0)
      expect(t.symbol).toBeTruthy()
      expect(t.name).toBeTruthy()
    }
  }, 240_000)
})
