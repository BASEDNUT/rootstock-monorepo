import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/**
 * Auditor round-2 FIX-2 (A/F-06 + B/F-07 + B/F-10): discovery freshness.
 * - Per-chain TTL (5 min): an expired cached scan is cleared and rescanned.
 * - Incremental cursor: next scan starts at lastScannedBlock + 1 (exclusive
 *   boundary — no overlapping eth_getLogs ranges, no restart from
 *   scanConfig.fromBlock).
 * - invalidateDiscovery(chain): clears the cached promise so the next fetch
 *   rescans (called after successful pool creation); the live registry and
 *   cursor are kept — newly created pools sit in blocks AFTER the cursor.
 */

const h = vi.hoisted(() => {
  return {
    /** captured eth_getLogs params (fromBlock/toBlock hex) per call */
    logCalls: [] as { from: string; to: string }[],
    /** latest block number the mocked client reports */
    blockNumber: 47_000_000n,
  }
})

vi.mock('viem', async importOriginal => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: vi.fn(async () => h.blockNumber),
      request: vi.fn(async ({ method, params }: { method: string; params: unknown[] }) => {
        if (method === 'eth_getLogs') {
          const range = params[0] as { fromBlock: string; toBlock: string }
          h.logCalls.push({ from: range.fromBlock, to: range.toBlock })
          return []
        }

        return []
      }),
      readContract: vi.fn(async () => 'test'),
    })),
  }
})

import {
  ONCHAIN_DISCOVERY_TTL_MS,
  REORG_SAFETY_BLOCKS,
  chunkedLogRanges,
  fetchDiscoveredPools,
  invalidateDiscovery,
  isDiscoveryCacheExpired,
  nextScanStartBlock,
  resetDiscoveryCachesForTests,
} from './onchain-pool-fetch'
import { loadDiscoveredPoolsStore } from './onchain-discovery-store'

const fromHex = (s: string) => parseInt(s, 16)

beforeEach(() => {
  h.logCalls.length = 0
  h.blockNumber = 47_000_000n
  resetDiscoveryCachesForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('discovery cache pure functions (auditor round-2 FIX-2)', () => {
  it('nextScanStartBlock: no cursor → fromBlock; cursor → reorg overlap (cursor + 1 - safety)', () => {
    expect(nextScanStartBlock(undefined, 46_984_000)).toBe(46_984_000)
    // overlap window: the last safety blocks are re-scanned so a
    // reorged-in registration is never skipped by the cursor
    expect(nextScanStartBlock(46_999_999, 46_984_000)).toBe(46_999_936)
    // never below fromBlock (clamp)
    expect(nextScanStartBlock(46_984_010, 46_984_000)).toBe(46_984_000)
  })

  it('chunkedLogRanges: covers the window with NO overlapping boundaries', () => {
    const ranges = chunkedLogRanges(46_999_000, 47_000_500, 500)

    // window 46_999_000..47_000_500 = 1,501 blocks / 500 = 4 chunks
    expect(ranges.length).toBe(4)

    // newest-first continuation: every older chunk's to + 1 = the next
    // (newer) chunk's from — exclusive boundaries, zero overlap
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i - 1]!.from).toBe(ranges[i]!.to + 1)
    }

    // full coverage, exact window bounds
    expect(Math.min(...ranges.map(r => r.from))).toBe(46_999_000)
    expect(Math.max(...ranges.map(r => r.to))).toBe(47_000_500)
  })

  it('chunkedLogRanges: empty when latest is behind the start (nothing new)', () => {
    expect(chunkedLogRanges(47_000_000, 46_999_999, 500)).toEqual([])

    expect(chunkedLogRanges(47_000_000, 47_000_000, 500)).toEqual([
      { from: 47_000_000, to: 47_000_000 },
    ])
  })

  it('isDiscoveryCacheExpired: never-scanned/expired → true; fresh → false', () => {
    const now = 1_000_000
    expect(isDiscoveryCacheExpired(undefined, now)).toBe(true)
    expect(isDiscoveryCacheExpired(now - ONCHAIN_DISCOVERY_TTL_MS, now)).toBe(true)
    expect(isDiscoveryCacheExpired(now - ONCHAIN_DISCOVERY_TTL_MS + 1, now)).toBe(false)
    expect(isDiscoveryCacheExpired(now - 60_000, now)).toBe(false)
  })
})

describe('discovery TTL + incremental cursor (live path, mocked client)', () => {
  it('first scan starts at scanConfig.fromBlock; second fetch within TTL is cached (no new logs calls)', async () => {
    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    expect(h.logCalls.length).toBeGreaterThan(0)
    // first range set must END at the latest block and START >= fromBlock
    const maxTo = Math.max(...h.logCalls.map(c => fromHex(c.to)))
    const minFrom = Math.min(...h.logCalls.map(c => fromHex(c.from)))
    expect(maxTo).toBe(Number(h.blockNumber))
    expect(minFrom).toBeGreaterThanOrEqual(46_984_000)

    const callsAfterFirst = h.logCalls.length
    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    expect(h.logCalls.length).toBe(callsAfterFirst) // cached — no rescan
  })

  it('TTL expiry clears the cached scan and rescans from the cursor (NOT fromBlock)', async () => {
    vi.useFakeTimers()
    const t0 = Date.now()

    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    const firstScanCalls = h.logCalls.length
    expect(firstScanCalls).toBeGreaterThan(0)
    const firstMinFrom = Math.min(...h.logCalls.map(c => fromHex(c.from)))

    // advance past the TTL — the cached scan is expired
    vi.setSystemTime(t0 + ONCHAIN_DISCOVERY_TTL_MS + 1)
    h.blockNumber = 47_000_600n // chain moved forward

    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    expect(h.logCalls.length).toBeGreaterThan(firstScanCalls) // rescan happened

    // reorg-safe: the rescan starts at the finalized-head cursor + 1
    // minus the safety overlap - never back at fromBlock
    const rescanMinFrom = Math.min(...h.logCalls.slice(firstScanCalls).map(c => fromHex(c.from)))

    expect(rescanMinFrom).toBeGreaterThan(firstMinFrom)
    expect(rescanMinFrom).toBe(46_999_873) // finalized cursor + 1 - safety overlap
  })

  it('invalidateDiscovery forces a rescan on the next fetch (creation invalidation)', async () => {
    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    const callsAfterFirst = h.logCalls.length

    // A pool was just created in a NEW block — the chain head advanced.
    h.blockNumber = 47_000_400n
    invalidateDiscovery(GqlChainValues.BaseSepolia)

    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    expect(h.logCalls.length).toBeGreaterThan(callsAfterFirst) // fresh scan

    // the rescan covers the overlap window → new head (full tip)
    const rescanMinFrom = Math.min(...h.logCalls.slice(callsAfterFirst).map(c => fromHex(c.from)))

    const rescanMaxTo = Math.max(...h.logCalls.slice(callsAfterFirst).map(c => fromHex(c.to)))

    expect(rescanMinFrom).toBe(46_999_873) // reorg overlap window start
    expect(rescanMaxTo).toBe(47_000_400) // new head
  })

  it('no new blocks: rescan is bounded to the reorg-overlap window - one chunk, never history', async () => {
    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    const callsAfterFirst = h.logCalls.length

    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + ONCHAIN_DISCOVERY_TTL_MS + 1)
    // blockNumber unchanged - only the safety-overlap window is rescanned:
    // at most one 500-block chunk, never full history

    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)
    expect(h.logCalls.length).toBe(callsAfterFirst + 1)
  })
})

describe('reorg-safety laws (finalized-head cursor)', () => {
  it('exports the safety-margin constant', () => {
    expect(REORG_SAFETY_BLOCKS).toBe(64)
  })

  it('a scan advances the cursor only to the finalized head - latest minus the safety margin', async () => {
    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)

    const store = loadDiscoveredPoolsStore(84532, 46_984_000)
    expect(store).not.toBeNull()
    expect(store!.cursor).toBe(46_999_936) // 47_000_000 - 64
  })

  it('a scan still covers the full tip - newly created pools appear immediately', async () => {
    h.blockNumber = 47_000_600n
    await fetchDiscoveredPools(GqlChainValues.BaseSepolia)

    const maxTo = Math.max(...h.logCalls.map(c => fromHex(c.to)))
    expect(maxTo).toBe(47_000_600)
  })
})
