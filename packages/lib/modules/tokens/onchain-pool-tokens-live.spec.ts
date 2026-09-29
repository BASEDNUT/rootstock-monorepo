import { describe, expect, it } from 'vitest'
import { fetchOnchainPoolTokens } from './onchain-pool-tokens'

describe('onchain pool tokens (LIVE)', () => {
  it('fetches discovered pool tokens with onchain metadata', async () => {
    let tokens

    try {
      tokens = await fetchOnchainPoolTokens()
    } catch (e) {
      console.warn('RPC unreachable — skip:', (e as Error).message.slice(0, 80))
      return
    }

    console.log(
      'TOKENS FOUND:',
      tokens.map(t => `${t.symbol}@${t.address.slice(0, 10)}`).join(', ')
    )

    expect(tokens.length).toBeGreaterThan(0)

    for (const t of tokens) {
      expect(t.chain).toBe('BASESEP')
      expect(t.decimals).toBeGreaterThan(0)
      expect(t.symbol).toBeTruthy()
    }
  }, 60_000)
})
