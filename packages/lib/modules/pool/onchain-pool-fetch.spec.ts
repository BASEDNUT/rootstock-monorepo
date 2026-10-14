import { describe, expect, it } from 'vitest'
import { shouldAwaitLiveScan, shouldDropCachedScan } from './onchain-pool-fetch'
import type { OnchainPoolListItem } from './onchain-pool-discovery'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/**
 * fetchDiscoveredPools race decision — when the live
 * scan loses the 500ms race AND the baked registry is EMPTY (Base mainnet
 * today: 0 displayed pools), await the live promise to completion (one-time
 * ~75s cold cost; the UI shows isLoading via useQuery — honest loading
 * state) instead of returning an empty list until the next refetch.
 * Sepolia path unchanged (baked present → return baked immediately).
 */

const item = {
  id: '0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7',
  address: '0x1aba4e89fd64e41fe3081fabf6ce33cb613977c7',
  chain: GqlChainValues.Base,
  type: 'WEIGHTED',
  protocolVersion: 3,
  symbol: 'rks-WETH-BAL',
  name: 'Rootstock WETH/BAL Pool',
  factory: '0x9a5bd368c8da0d7fad33fc89b6be4e39e5a33f92',
  createTime: 52_131_552,
  poolTokens: [],
  dynamicData: { totalLiquidity: '0', volume24h: '0', fees24h: '0', aprItems: [] },
} as unknown as OnchainPoolListItem

describe('shouldAwaitLiveScan', () => {
  it('awaits when live is unresolved and baked is empty (mainnet cold path)', () => {
    expect(shouldAwaitLiveScan(null, [])).toBe(true)
  })

  it('returns baked when live is unresolved but baked exists (Sepolia path)', () => {
    expect(shouldAwaitLiveScan(null, [item])).toBe(false)
  })

  it('merges immediately when live wins the race', () => {
    expect(shouldAwaitLiveScan([item], [])).toBe(false)
  })
})

describe('reEnrichIncompleteRecords', () => {
  const INCOMPLETE = {
    address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    factory: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    blockNumber: 100,
  }

  const COMPLETE = {
    address: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    factory: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    blockNumber: 101,
    name: 'Done',
    symbol: 'DONE',
    tokens: ['0x1111111111111111111111111111111111111111'],
    enriched: true,
  }

  it('re-reads metadata for incomplete records only and marks them enriched', async () => {
    const { reEnrichIncompleteRecords } = await import('./onchain-pool-fetch')

    const reads: string[] = []

    const client = {
      readContract: async ({
        address,
        functionName,
      }: {
        address: string
        functionName: string
      }) => {
        reads.push(`${functionName}:${address}`)
        if (functionName === 'name') return 'Healed Pool'
        if (functionName === 'symbol') return 'HPL'
        return [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ]
      },
    }

    const out = await reEnrichIncompleteRecords(client as never, [INCOMPLETE, COMPLETE])

    const healed = out.find(r => r.address === INCOMPLETE.address)!
    expect(healed.name).toBe('Healed Pool')
    expect(healed.symbol).toBe('HPL')
    expect(healed.tokens).toHaveLength(2)
    expect(healed.enriched).toBe(true)

    // the complete record is untouched - never re-read
    expect(reads.filter(r => r.includes(COMPLETE.address))).toHaveLength(0)
    // exactly 3 reads for the incomplete pool (name, symbol, getTokens)
    expect(reads.filter(r => r.includes(INCOMPLETE.address))).toHaveLength(3)
  })

  it('a still-failing read leaves the record incomplete - retried next scan, never throws', async () => {
    const { reEnrichIncompleteRecords } = await import('./onchain-pool-fetch')

    const client = {
      readContract: async () => {
        throw new Error('rpc still down')
      },
    }

    const out = await reEnrichIncompleteRecords(client as never, [INCOMPLETE])
    expect(out).toHaveLength(1)
    expect(out[0]!.enriched).toBeUndefined()
    expect(out[0]!.tokens).toBeUndefined()
  })
})

describe('shouldDropCachedScan (in-flight dedup)', () => {
  it('never drops an in-flight scan, even when the cache is stale', () => {
    expect(shouldDropCachedScan(true, true, true)).toBe(false)
  })

  it('drops a settled cached scan when the cache is stale', () => {
    expect(shouldDropCachedScan(true, false, true)).toBe(true)
  })

  it('keeps a settled fresh scan', () => {
    expect(shouldDropCachedScan(true, false, false)).toBe(false)
  })

  it('no cached promise means nothing to drop', () => {
    expect(shouldDropCachedScan(false, true, true)).toBe(false)
    expect(shouldDropCachedScan(false, false, false)).toBe(false)
  })
})
