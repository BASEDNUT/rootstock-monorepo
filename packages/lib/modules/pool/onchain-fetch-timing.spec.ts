import { describe, expect, it } from 'vitest'
import { fetchDiscoveredPools } from './onchain-pool-fetch'

describe('discovery timing (LIVE)', () => {
  it('measures cold-start fetch time', async () => {
    const t0 = Date.now()
    let pools

    try {
      pools = await fetchDiscoveredPools()
    } catch (e) {
      console.warn('RPC unreachable — skip:', (e as Error).message.slice(0, 80))
      return
    }

    const ms = Date.now() - t0
    console.log(`COLD-START: ${ms}ms for ${pools.length} pools`)
    expect(pools.length).toBeGreaterThan(0)

    // record for state
    console.log(
      `POOL_REGISTRY: ${JSON.stringify(pools.map(p => ({ a: p.address, t: p.type, s: p.symbol })))}`
    )
  }, 120_000)
})
