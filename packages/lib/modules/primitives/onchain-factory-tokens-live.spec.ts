import { describe, expect, it } from 'vitest'
import { fetchOnchainFactoryTokens } from './onchain-factory-tokens'
import { classifyLiveStrictError } from '@repo/lib/shared/utils/live-strict'

/**
 * LIVE: factory event scan (TokenCreated / WrapperCreated) against
 * sepolia.base.org. Zero tokens is a VALID result — no creations exist yet.
 */
// Strict gate — default: vitest-SKIPPED (skip class, no
// public-RPC dependence in the default suite); strict (ROOTSTOCK_LIVE_STRICT=1):
// runs against the real chain and the catch RETHROWS — unreachable RPC FAILS.
describe.skipIf(process.env.ROOTSTOCK_LIVE_STRICT !== '1')('onchain factory tokens (LIVE)', () => {
  // : per-chain — BASESEP (84532) + BASE (8453) both carry
  // primitives deployments; each chain scans its own factories with
  // chain-correct tags. Zero tokens is a VALID result (no creations yet).
  const chains: [string, number][] = [
    ['BASESEP', 84532],
    ['BASE', 8453],
  ]

  for (const [label, chainId] of chains) {
    it(`${label}: scans both factories without throwing; found tokens carry metadata`, async ctx => {
      let tokens

      try {
        tokens = await fetchOnchainFactoryTokens(chainId)
      } catch (e) {
        // Infrastructure failure = explicit, counted skip; logic failure throws.
        const decision = classifyLiveStrictError(e)
        if (decision.action === 'throw') throw decision.error
        ctx.skip(`LIVE SKIP (infrastructure): ${decision.reason.slice(0, 200)}`)
        return
      }

      console.log(
        `FACTORY TOKENS [${label}]:`,
        tokens.map(t => `${t.symbol}@${t.address.slice(0, 10)}`).join(', ') || '(none yet)'
      )

      for (const t of tokens) {
        expect(t.chainId).toBe(chainId)
        expect(t.decimals).toBeGreaterThan(0)
        expect(t.symbol).toBeTruthy()
        expect(t.name).toBeTruthy()
      }
    }, 240_000)
  }
})
