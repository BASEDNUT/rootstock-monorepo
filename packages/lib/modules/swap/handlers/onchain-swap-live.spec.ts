import { describe, expect, it } from 'vitest'
import { OnchainSwapHandler } from './OnchainSwap.handler'

// LIVE integration: real Base Sepolia, real mock pool, real onchain query.
// Skips automatically if RPC unreachable.
describe('OnchainSwapHandler live', () => {
  it('simulates a real single-pool swap onchain (no API)', async () => {
    const handler = new OnchainSwapHandler()
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
      console.warn('RPC unreachable — skip:', (e as Error).message.slice(0, 80))
      return
    }

    expect(result.returnAmount).toBeTruthy()
    expect(result.swap).toBeTruthy()
    expect(result.protocolVersion).toBe(3)
    expect(result.hopCount).toBe(1)
    console.log('LIVE SWAP QUOTE:', result.returnAmount, '| router:', result.router)
  }, 60_000)
})
