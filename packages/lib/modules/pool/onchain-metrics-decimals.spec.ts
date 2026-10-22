import { describe, expect, it, vi } from 'vitest'
import { resolveTokenDecimals, fetchMissingTokenDecimals } from './onchain-metrics-io'

/*
 * B1 (live-caught 2026-10-21): pool-list TVL treated every token as
 * 18 decimals — the caller decimalsByAddress (remote token catalog)
 * does not know Rootstock pool tokens, so SNUT(9)/cbBTC(8)/tBTC(8)/
 * EURC(6)/USDC(6)/NVDAc(8)/AAPLc(8) legs computed as $0.00 (pNUT
 * showed $82 vs $161 on-chain truth). The metrics path must resolve
 * decimals from the pools themselves (baked-registry poolTokens carry
 * ERC20 metadata), with an onchain erc20 multicall for the rest.
 */

const pool = (tokens: { address: string; decimals?: number }[]) => ({ poolTokens: tokens })

const SNUT = '0xAC130701aa31c284c36609E2489f150F419AD7AD'
const CBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'
const USDC = '0x833589fCD5eDb6E6fa2CAb1B97BaD1B63f34E4d1'
const WNUT = '0xBA5ED46e31F80dafF307cbf60bd422a6f62E3dd3'

describe('resolveTokenDecimals — registry-first decimals resolution (B1)', () => {
  it('extracts decimals from baked poolTokens (SNUT 9, cbBTC 8)', () => {
    const pools = [pool([
      { address: SNUT, decimals: 9 },
      { address: CBTC, decimals: 8 },
    ])]
    const { decimals, missing } = resolveTokenDecimals(pools, {})
    expect(decimals[SNUT.toLowerCase()]).toBe(9)
    expect(decimals[CBTC.toLowerCase()]).toBe(8)
    expect(missing).toEqual([])
  })

  it('caller map fills tokens absent from poolTokens', () => {
    const pools = [pool([{ address: SNUT, decimals: 9 }, { address: USDC }])]
    const { decimals } = resolveTokenDecimals(pools, { [USDC.toLowerCase()]: 6 })
    expect(decimals[USDC.toLowerCase()]).toBe(6)
    expect(decimals[SNUT.toLowerCase()]).toBe(9)
  })

  it('registry poolTokens decimals WIN over the caller map (chain truth beats catalog)', () => {
    const pools = [pool([{ address: SNUT, decimals: 9 }])]
    const { decimals } = resolveTokenDecimals(pools, { [SNUT.toLowerCase()]: 18 })
    expect(decimals[SNUT.toLowerCase()]).toBe(9)
  })

  it('tokens unresolved by either source are listed for the erc20 multicall', () => {
    const pools = [pool([{ address: SNUT, decimals: 9 }, { address: USDC }])]
    const { missing } = resolveTokenDecimals(pools, {})
    expect(missing).toEqual([USDC.toLowerCase()])
  })

  it('live-only pools with address-only tokens degrade to caller map / missing — never crash', () => {
    const pools = [pool([{ address: WNUT }]), pool([])]
    const { decimals, missing } = resolveTokenDecimals(pools, { [WNUT.toLowerCase()]: 18 })
    expect(decimals[WNUT.toLowerCase()]).toBe(18)
    expect(missing).toEqual([])
  })

  it('duplicate tokens across pools resolve once (no missing duplicates)', () => {
    const pools = [pool([{ address: USDC }]), pool([{ address: USDC }])]
    const { missing } = resolveTokenDecimals(pools, {})
    expect(missing).toEqual([USDC.toLowerCase()])
  })
})

describe('fetchMissingTokenDecimals — onchain erc20 fallback (B1)', () => {
  it('multicall results map lowercase addresses; failures are skipped', async () => {
    const multicall = vi.fn(async () => [
      { status: 'success', result: 6 },
      { status: 'failure', error: new Error('revert') },
    ])
    const out = await fetchMissingTokenDecimals(
      { multicall } as unknown as Parameters<typeof fetchMissingTokenDecimals>[0],
      [USDC, WNUT]
    )
    expect(out[USDC.toLowerCase()]).toBe(6)
    expect(out[WNUT.toLowerCase()]).toBeUndefined()
    expect(multicall).toHaveBeenCalledTimes(1)
  })

  it('empty address list → {} without calling the client', async () => {
    const multicall = vi.fn(async () => [])
    const out = await fetchMissingTokenDecimals(
      { multicall } as unknown as Parameters<typeof fetchMissingTokenDecimals>[0],
      []
    )
    expect(out).toEqual({})
    expect(multicall).not.toHaveBeenCalled()
  })

  it('multicall throw → honest {} (unresolved stays the 18 default at the consumer)', async () => {
    const multicall = vi.fn(async () => {
      throw new Error('rpc down')
    })
    const out = await fetchMissingTokenDecimals(
      { multicall } as unknown as Parameters<typeof fetchMissingTokenDecimals>[0],
      [USDC]
    )
    expect(out).toEqual({})
  })
})
