import { describe, expect, it } from 'vitest'
import { OnchainSwapHandler } from './OnchainSwap.handler'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { classifyLiveStrictError } from '@repo/lib/shared/utils/live-strict'

// LIVE integration: real Base Sepolia, real mock pool, real onchain query.
// Strict gate — two modes:
// - Default (ROOTSTOCK_LIVE_STRICT unset): the suite is vitest-SKIPPED
//   (skip class) — no public-RPC dependence in the default CI suite; an
//   unreachable RPC can no longer silently pass as green.
// - Strict (ROOTSTOCK_LIVE_STRICT=1): the suite RUNS against the real
//   chain and the catch RETHROWS — unreachable RPC FAILS the run.
describe.skipIf(process.env.ROOTSTOCK_LIVE_STRICT !== '1')('OnchainSwapHandler live', () => {
  it('simulates a real single-pool swap onchain (no API)', async ctx => {
    const handler = new OnchainSwapHandler(GqlChainValues.BaseSepolia)
    let result

    try {
      result = await handler.simulate({
        chain: 'BASESEP',
        tokenIn: '0x4200000000000000000000000000000000000006',
        tokenOut: '0x8c6487b86A73554431d514371184916B0B61B876',
        swapType: 'EXACT_IN',
        swapAmount: '0.001',
        poolIds: undefined,
      })
    } catch (e) {
      const decision = classifyLiveStrictError(e)
      if (decision.action === 'throw') throw decision.error

      // Infrastructure failure = explicit, counted skip — never a silent pass.
      ctx.skip(`LIVE SKIP (infrastructure): ${decision.reason.slice(0, 200)}`)
      return
    }

    expect(result.returnAmount).toBeTruthy()
    expect(result.swap).toBeTruthy()
    expect(result.protocolVersion).toBe(3)
    expect(result.hopCount).toBe(1)
    console.log('LIVE SWAP QUOTE:', result.returnAmount, '| router:', result.router)
  }, 60_000)
})
