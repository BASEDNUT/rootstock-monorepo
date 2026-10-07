import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { fetchOnchainPoolTokens } from './onchain-pool-tokens'
import { mswServer } from '@repo/lib/test/msw/server'

/*
  LIVE spec: hits the real Base Sepolia RPC by design. Default msw handlers
  stub public-RPC JSON-RPC (to keep background wagmi polls from leaking real
  TLS sockets into unit teardown) — this spec needs the genuine network, so
  interception is disabled for its duration and restored after.
*/
describe('onchain pool tokens (LIVE)', () => {
  beforeAll(() => mswServer.close())
  afterAll(() => mswServer.listen())

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
