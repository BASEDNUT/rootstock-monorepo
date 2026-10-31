import { describe, expect, it, beforeEach } from 'vitest'
import {
  loadActivityStore,
  saveActivityStore,
  mergeActivityEvents,
  ACTIVITY_STORE_VERSION,
} from './onchain-activity-store'
import { decodeActivityLog, scanPoolActivity, ACTIVITY_TOPICS } from './onchain-activity-scan'
import type { BakedPoolEvent } from './onchain-pool-events-builder'

/*
 * B4 (2026-10-31): live activity continuation — store laws + decoder goldens
 * (REAL logs from our Base mainnet Vault: pNUT initialize ADD block
 * 52913373, pipsUSDC SWAP block 52709325 — same fixtures as the green
 * onchain-pool-events.spec.ts) + prefix-run scan law.
 */

const GOLDEN_ADD = {
  blockNumber: '0x32764dd',
  transactionHash: '0x013c7fbd1eb081318430904595628c9248b87eff26b0b6b43e41874588b0ae61',
  logIndex: '0x5',
  topics: [
    '0xa26a52d8d53702bba7f137907b8e1f99ff87f6d450144270ca25e72481cca871',
    '0x000000000000000000000000f64ae6f64be7c223092c399dfd2e388db5e16080',
    '0x000000000000000000000000135b208ac2480b0d876944416de16e7a3b9a1f65',
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  ],
  data: '0x00000000000000000000000000000000000000000000000000bf70d70da063590000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000031b99af09d6246000000000000000000000000000000000000000000000000000000b3ac4eee80000000000000000000000000000000000000000000000000000526c46eeca000000000000000000000000000000000000000000000000000000000000000b82300000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
}

const GOLDEN_SWAP = {
  blockNumber: '0x32447cd',
  transactionHash: '0x5e9459d130b20356b34e246bb95a6aa81b0d8a4b3cfe39c22a4d796f4005fd48',
  logIndex: '0x2',
  topics: [
    '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db',
    '0x000000000000000000000000f8e5ca8397ed7fa5c17ebd73c3b42660abf62c53',
    '0x0000000000000000000000003f2327221dd4f0bae660172606d6b288a1cf8ad9',
    '0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  ],
  data: '0x000000000000000000000000000000000000000000013f5251039adbfc8cc51b000000000000000000000000000000000000000000000000000000000100e202000000000000000000000000000000000000000000000000002386f26fc100000000000000000000000000000000000000000000000003317691f4bfa3ce352c',
}

const TS = new Map([
  [52913373, 1792616093],
  [52709325, 1792207997],
])

// ---- store laws ----

describe('activity store — localStorage laws', () => {
  beforeEach(() => localStorage.clear())

  const mk = (over: Partial<Parameters<typeof saveActivityStore>[0]> = {}) => ({
    version: ACTIVITY_STORE_VERSION,
    chainId: 8453,
    poolId: '0xABCdef0000000000000000000000000000000001',
    cursor: 100,
    savedAt: 1,
    events: [],
    ...over,
  })

  it('saves and loads round-trip', () => {
    saveActivityStore(mk({ cursor: 42, events: [] }))
    const s = loadActivityStore(8453, '0xabcdef0000000000000000000000000000000001')
    expect(s?.cursor).toBe(42)
    expect(s?.chainId).toBe(8453)
  })

  it('voids a store with wrong version/chainId/pool (never trusts)', () => {
    localStorage.setItem(
      'rootstock.pool-activity.8453.0xabcdef0000000000000000000000000000000001',
      JSON.stringify({ ...mk(), version: 999 })
    )

    expect(loadActivityStore(8453, '0xabcdef0000000000000000000000000000000001')).toBeNull()
  })

  it('returns null on malformed JSON (never throws)', () => {
    localStorage.setItem(
      'rootstock.pool-activity.8453.0xabcdef0000000000000000000000000000000001',
      '{oops'
    )

    expect(loadActivityStore(8453, '0xabcdef0000000000000000000000000000000001')).toBeNull()
  })
})

describe('mergeActivityEvents — dedupe by (type, tx, logIndex)', () => {
  const a: BakedPoolEvent = {
    pool: '0xp',
    tx: '0xT1',
    timestamp: 5,
    block: 1,
    type: 'ADD',
    userAddress: '0xu',
    logIndex: 3,
  }

  const dup: BakedPoolEvent = { ...a, timestamp: 5, block: 1 }

  const b: BakedPoolEvent = {
    pool: '0xp',
    tx: '0xT2',
    timestamp: 9,
    block: 2,
    type: 'SWAP',
    userAddress: '0xu',
    logIndex: 0,
  }

  it('collapses identical keys, keeps newest-first order', () => {
    const out = mergeActivityEvents([a, b], [dup])
    expect(out).toHaveLength(2)
    expect(out[0]!.tx).toBe('0xT2') // newest first
  })

  it('same tx different logIndex = two events (real tx with add+swap)', () => {
    const out = mergeActivityEvents([a], [{ ...b, tx: '0xT1' }])
    expect(out).toHaveLength(2)
  })
})

// ---- decoder goldens ----

describe('decodeActivityLog — real Vault logs', () => {
  it('decodes ADD with kind/userAddress/totalSupply/amountsRaw', () => {
    const e = decodeActivityLog(GOLDEN_ADD, TS)!
    expect(e).not.toBeNull()
    expect(e.type).toBe('ADD')
    expect(e.pool).toBe('0xf64ae6f64be7c223092c399dfd2e388db5e16080')
    expect(e.userAddress).toBe('0x135b208ac2480b0d876944416de16e7a3b9a1f65')
    expect(e.kind).toBe(1)
    expect(e.timestamp).toBe(1792616093)
    expect(e.block).toBe(52913373)
    expect(e.logIndex).toBe(5)
    expect(e.amountsRaw).toHaveLength(4)
    expect(e.totalSupply).toBe('53885789500629849')
  })

  it('decodes SWAP with tokenIn/tokenOut raw amounts, zero-address sender pre-backfill', () => {
    const e = decodeActivityLog(GOLDEN_SWAP, TS)!
    expect(e.type).toBe('SWAP')
    expect(e.tokenIn).toBe('0x3f2327221dd4f0bae660172606d6b288a1cf8ad9')
    expect(e.tokenOut).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
    expect(e.amountInRaw).toBe('1507953378729272634295579')
    expect(e.amountOutRaw).toBe('16835074')
    expect(e.userAddress).toBe('0x' + '0'.repeat(40))
  })

  it('returns null for unknown topic / malformed (never throws)', () => {
    expect(decodeActivityLog(null, TS)).toBeNull()
    expect(decodeActivityLog({ ...GOLDEN_ADD, topics: ['0xdead'] }, TS)).toBeNull()
    expect(decodeActivityLog({ ...GOLDEN_ADD, data: '0x' }, TS)).toBeNull()
  })
})

// ---- prefix-run scan law ----

function mkClient(chunks: Record<string, RawLog[] | Error>) {
  const calls: string[] = []
  return {
    calls,
    client: {
      request: async ({ params }: { params: unknown[] }) => {
        const [filter] = params as [{ fromBlock: string; toBlock: string }]
        const key = `${parseInt(filter.fromBlock, 16)}-${parseInt(filter.toBlock, 16)}`
        calls.push(key)
        const v = chunks[key]
        if (v instanceof Error) throw v
        return v ?? []
      },
    },
  }
}

type RawLog = {
  blockNumber: string
  transactionHash: string
  logIndex: string
  topics: string[]
  data: string
}

const logAt = (block: number): RawLog => ({
  blockNumber: '0x' + block.toString(16),
  transactionHash: '0xtx' + block,
  logIndex: '0x0',
  topics: GOLDEN_SWAP.topics,
  data: GOLDEN_SWAP.data,
})

describe('scanPoolActivity — D3 prefix-run law', () => {
  it('covers all chunks when none fail; cursor at latest', async () => {
    const { client, calls } = mkClient({})

    const r = await scanPoolActivity({
      client,
      vault: '0xv',
      pool: '0xp',
      fromBlock: 100,
      latestBlock: 110,
      chunkSize: 5,
      getBlockTimestamp: async () => 1,
      getTxFrom: async () => '0xsender',
    })

    expect(calls).toEqual(['101-105', '106-110'])
    expect(r.coveredTo).toBe(110)
    expect(r.events).toHaveLength(0)
    expect(r.contiguousEvents).toHaveLength(0)
  })

  it('observes logs across all successful chunks; all are contiguous', async () => {
    const withLogs = { '101-105': [logAt(103)], '106-110': [logAt(108)] }
    const { client } = mkClient(withLogs)

    const r = await scanPoolActivity({
      client,
      vault: '0xv',
      pool: '0xp',
      fromBlock: 100,
      latestBlock: 110,
      chunkSize: 5,
      getBlockTimestamp: async () => 7,
      getTxFrom: async () => undefined,
    })

    expect(r.coveredTo).toBe(110)
    expect(r.events).toHaveLength(2)
    expect(r.contiguousEvents).toHaveLength(2)
  })

  it('real hole: first failing chunk ends the contiguous run; later logs observed-only', async () => {
    const chunks: Record<string, RawLog[] | Error> = {
      '101-105': [logAt(103)],
      '106-110': new Error('block range too large'),
      '111-115': [logAt(113)],
    }

    const { client } = mkClient(chunks)

    const r = await scanPoolActivity({
      client,
      vault: '0xv',
      pool: '0xp',
      fromBlock: 100,
      latestBlock: 115,
      chunkSize: 5,
      getBlockTimestamp: async () => 9,
      getTxFrom: async () => undefined,
    })

    expect(r.coveredTo).toBe(105) // prefix ends BEFORE the hole
    expect(r.contiguousEvents).toHaveLength(1) // only block-103 log
    expect(r.events).toHaveLength(2) // 113 observed (display-grade)
  })

  it('empty range (fromBlock >= latest) covers nothing, never throws', async () => {
    const { client } = mkClient({})

    const r = await scanPoolActivity({
      client,
      vault: '0xv',
      pool: '0xp',
      fromBlock: 200,
      latestBlock: 200,
      chunkSize: 5,
      getBlockTimestamp: async () => 1,
      getTxFrom: async () => undefined,
    })

    expect(r.coveredTo).toBe(200)
    expect(r.events).toHaveLength(0)
  })

  it('swap sender backfilled from getTxFrom; failure keeps zero-address', async () => {
    const { client } = mkClient({ '101-105': [logAt(103)] })

    const r = await scanPoolActivity({
      client,
      vault: '0xv',
      pool: '0xp',
      fromBlock: 100,
      latestBlock: 105,
      chunkSize: 5,
      getBlockTimestamp: async () => 9,
      getTxFrom: async h => (h.includes('103') ? '0xSENDER123' : undefined),
    })

    expect(r.events[0]?.userAddress).toBe('0xsender123')
  })

  it('OR-topics carry all three activity types', () => {
    expect(ACTIVITY_TOPICS).toHaveLength(3)
  })
})
