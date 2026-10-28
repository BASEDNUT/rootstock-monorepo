import { describe, expect, it, vi } from 'vitest'

/*
 * B3 (live-probed 2026-10-21): publicnode archive-walls any getLogs range
 * older than its recent window ("Archive requests require a personal
 * token") — even 5k-block ranges ~11h back. The Tenderly public gateway
 * (CORS-open, browser-verified) serves 1000-block archive ranges. The
 * window scan must fall back per-chunk, subdivide fallback chunks at the
 * gateway limit, and track CONTIGUITY: a failed chunk is a hole and
 * coverage restarts at the next successful chunk (honest coveredFrom).
 */

vi.mock('viem', async importOriginal => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({})),
  }
})

import { scanSwapBuckets } from './onchain-metrics-io'

const VAULT = '0x0a3af0da0175afa0cc05a6ad9092dc740155a0e7'
const SWAP_TOPIC = '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db'
const POOL = '0x' + 'a'.repeat(40)
const TOKEN = '0x' + 'b'.repeat(40)

const swapLog = (block: number) => ({
  blockNumber: '0x' + block.toString(16),
  topics: [
    SWAP_TOPIC,
    '0x' + POOL.slice(2).padStart(64, '0'),
    '0x' + TOKEN.slice(2).padStart(64, '0'),
    '0x' + 'c'.repeat(64),
  ],
  data:
    '0x' +
    123456789n.toString(16).padStart(64, '0') +
    '0'.repeat(64) +
    '0'.repeat(64) +
    1000n.toString(16).padStart(64, '0'),
})

function makeClient(behavior: 'ok' | 'archive-walled' | 'throw') {
  return {
    request: vi.fn(async ({ method }: { method: string }) => {
      if (method !== 'eth_getLogs') return []
      if (behavior === 'throw') throw new Error('rpc down')

      if (behavior === 'archive-walled') {
        throw new Error(
          'Archive requests require a personal token. Get one at: https://www.allnodes.com/publicnode'
        )
      }

      return [swapLog(100)]
    }),
  }
}

describe('scanSwapBuckets — per-chunk archive fallback (B3)', () => {
  it('primary succeeds → no fallback calls', async () => {
    const primary = makeClient('ok')
    const fallback = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500, fallback as never)
    expect(res.buckets.length).toBeGreaterThan(0)
    expect(primary.request).toHaveBeenCalled()
    expect(fallback.request).not.toHaveBeenCalled()
  })

  it('archive-walled chunk falls back and its logs are counted', async () => {
    const primary = makeClient('archive-walled')
    const fallback = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500, fallback as never)
    expect(res.buckets.length).toBeGreaterThan(0)
    expect(fallback.request).toHaveBeenCalledTimes(1)
  })

  it('no fallback provided + walled primary → chunk skipped, no throw', async () => {
    const primary = makeClient('archive-walled')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500)
    expect(res.buckets).toEqual([])
  })

  it('both fail → chunk skipped, no throw (honest empty)', async () => {
    const primary = makeClient('archive-walled')
    const fallback = makeClient('throw')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500, fallback as never)
    expect(res.buckets).toEqual([])
  })

  it('non-archive primary error → NOT retried on fallback (fallback is archive-only)', async () => {
    const primary = makeClient('throw')
    const fallback = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500, fallback as never)
    expect(res.buckets).toEqual([])
    expect(fallback.request).not.toHaveBeenCalled()
  })
})

describe('scanSwapBuckets — contiguity + fallback subdivision (B3)', () => {
  it('returns coveredFrom = oldest contiguously scanned block', async () => {
    const primary = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500)
    expect(res.coveredFrom).toBe(91)
    expect(res.buckets.length).toBeGreaterThan(0)
  })

  it('empty range (fromBlock >= latest) → coveredFrom = fromBlock, no calls', async () => {
    const primary = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 100, 100, 500)
    expect(res.coveredFrom).toBe(100)
    expect(primary.request).not.toHaveBeenCalled()
  })

  it('mid-scan hole ends the prefix run — coveredTo stops BEFORE the hole (D3)', async () => {
    let call = 0

    const primary = {
      request: vi.fn(async () => {
        call++
        if (call === 2 || call === 3) throw new Error('rpc down') // chunk 2 fails BOTH attempts (D3 retry)
        return [swapLog(100)]
      }),
    }

    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 3)
    // prefix = chunk 1 only ([91-93]); the cursor re-attempts chunk 2 next scan
    expect(res.coveredFrom).toBe(91)
    expect(res.coveredTo).toBe(93)
    expect(res.contiguousBuckets.length).toBeGreaterThan(0)
  })

  it('all chunks fail → coveredFrom = latest + 1 (nothing covered)', async () => {
    const primary = makeClient('throw')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500)
    expect(res.coveredFrom).toBe(101)
    expect(res.buckets).toEqual([])
  })

  it('archive-walled chunk subdivides on fallback at fallbackChunkSize', async () => {
    const primary = makeClient('archive-walled')
    const fallback = makeClient('ok')

    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 10, fallback as never, 3)

    expect(fallback.request).toHaveBeenCalledTimes(4)
    expect(res.coveredFrom).toBe(91)
  })

  it('a failed fallback sub-chunk marks the whole chunk a hole', async () => {
    const primary = makeClient('archive-walled')
    let call = 0

    const fallback = {
      request: vi.fn(async () => {
        call++
        if (call <= 2) throw new Error('gateway 429') // sub-chunk fails BOTH attempts (D3 retry)
        return [swapLog(100)]
      }),
    }

    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 10, fallback as never, 5)
    expect(res.coveredFrom).toBe(101)
  })
})

describe('scanSwapBuckets — D3 contiguous-run tracking + transient retry (2026-10-27)', () => {
  it('reports coveredTo = end of the last contiguous run', async () => {
    const primary = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 5)
    expect(res.coveredFrom).toBe(91)
    expect(res.coveredTo).toBe(100)
  })

  it('mid-scan transient failure is retried once and rescued', async () => {
    // chunks [91-95][96-100]: first chunk throws once, retry succeeds.
    let call = 0

    const primary = {
      request: vi.fn(async () => {
        call++
        if (call === 1) throw new Error('socket hang up')
        return [swapLog(100)]
      }),
    }

    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 5)
    expect(res.coveredFrom).toBe(91)
    expect(res.coveredTo).toBe(100)
    expect(res.contiguousBuckets.length).toBeGreaterThan(0)
    expect(primary.request).toHaveBeenCalledTimes(3) // chunk1: fail+retry, chunk2: ok
  })

  it('permanent first-chunk hole → nothing covered (prefix broken at start)', async () => {
    let call = 0

    const primary = {
      request: vi.fn(async () => {
        call++
        if (call <= 2) throw new Error('rpc down') // chunk 1 fails BOTH attempts
        return [swapLog(100)]
      }),
    }

    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 5)
    // prefix law: run broken at the FIRST chunk → nothing covered (sentinel)
    expect(res.coveredFrom).toBe(101)
    expect(res.coveredTo).toBeLessThan(res.coveredFrom)
    expect(res.contiguousBuckets).toEqual([])
    // observed post-hole logs remain display-grade
    expect(res.buckets.length).toBeGreaterThan(0)
  })

  it('all chunks fail → coveredTo sentinel < coveredFrom, contiguousBuckets empty', async () => {
    const primary = makeClient('throw')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 500)
    expect(res.coveredFrom).toBe(101)
    expect(res.coveredTo).toBeLessThan(res.coveredFrom)
    expect(res.contiguousBuckets).toEqual([])
  })

  it('non-archive transient failure never hits the fallback (fallback stays archive-only)', async () => {
    let call = 0

    const primary = {
      request: vi.fn(async () => {
        call++
        if (call <= 2) throw new Error('timeout') // chunk 1: both attempts fail
        return [swapLog(100)]
      }),
    }

    const fallback = makeClient('ok')
    const res = await scanSwapBuckets(primary as never, VAULT, 90, 100, 5, fallback as never)
    // prefix law: hole at chunk 1 → nothing covered (sentinel); chunk 2's
    // logs remain display-grade only
    expect(res.coveredFrom).toBe(101)
    expect(res.coveredTo).toBeLessThan(res.coveredFrom)
    expect(fallback.request).not.toHaveBeenCalled()
    expect(primary.request).toHaveBeenCalledTimes(3) // chunk1: 2 failed attempts, chunk2: 1 success
  })
})
