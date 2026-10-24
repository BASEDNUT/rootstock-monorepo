import { describe, expect, it } from 'vitest'
import { enrichTokensMetadata } from './onchain-pool-fetch'

/**
 * Pills law (browser-verified defect 2026-10-24): live-only pools rendered
 * icon-only pills because the scan mapped tokens to { address } only.
 * enrichTokensMetadata reads ERC20 symbol/name/decimals for discovered
 * pool tokens — self-heals every future pool at discovery time.
 */

describe('enrichTokensMetadata', () => {
  it('reads symbol/name/decimals for every token', async () => {
    const client = {
      readContract: async ({ functionName }: { functionName: string }) => {
        if (functionName === 'symbol') return 'NUT'
        if (functionName === 'name') return 'Based Nut'
        return 18
      },
    }

    const out = await enrichTokensMetadata(client as never, [
      '0x1111111111111111111111111111111111111111',
    ])

    expect(out[0]).toEqual({
      address: '0x1111111111111111111111111111111111111111',
      symbol: 'NUT',
      name: 'Based Nut',
      decimals: 18,
    })
  })

  it('falls back to address-only on a failing token read - never throws', async () => {
    const client = {
      readContract: async () => {
        throw new Error('non-standard ERC20')
      },
    }

    const out = await enrichTokensMetadata(client as never, [
      '0x2222222222222222222222222222222222222222',
    ])

    expect(out[0]).toEqual({ address: '0x2222222222222222222222222222222222222222' })
  })

  it('returns [] for an empty token list without any reads', async () => {
    let reads = 0

    const client = {
      readContract: async () => {
        reads += 1
        return 'X'
      },
    }

    const out = await enrichTokensMetadata(client as never, [])
    expect(out).toEqual([])
    expect(reads).toBe(0)
  })
})
