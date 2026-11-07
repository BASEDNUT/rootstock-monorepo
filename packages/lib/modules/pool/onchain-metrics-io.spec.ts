import { describe, expect, it, vi } from 'vitest'

/*
 * S134e (2026-11-05, live-probed): Base switched block cadence at the
 * Sun Valley upgrade — 2.0 s/block before, 0.200 s/block after. Every
 * hour bucket was derived from `block x 2000ms` math anchored at the
 * chain tip, so post-switch events time-warped ~10x into the past and
 * fell OUTSIDE the trailing-24h window: the pools band showed $0.00
 * volume while real swaps existed on-chain.
 *
 * The fix: hour buckets come from REAL block timestamps
 * (eth_getBlockByNumber per unique event block), and the 2s math is only
 * a display-grade fallback when the probe fails.
 */

vi.mock('viem', async importOriginal => {
  const actual = await importOriginal<typeof import('viem')>()
  return { ...actual, createPublicClient: vi.fn(() => ({})) }
})

import { measureBlockMs, scanSwapBuckets } from './onchain-metrics-io'

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

/** Client that serves getLogs for blocks 90..101 and real block timestamps. */
function makeTsClient(blockTs: Record<number, number>, logs: number[] = [100, 101]) {
  return {
    request: vi.fn(async ({ method, params }: { method: string; params: unknown[] }) => {
      if (method === 'eth_getLogs') return logs.map(swapLog)

      if (method === 'eth_getBlockByNumber') {
        const b = parseInt(String(params[0]), 16)
        if (blockTs[b] === undefined) return null
        return { timestamp: '0x' + blockTs[b]!.toString(16) }
      }

      return []
    }),
  }
}

const HOUR = 3_600_000

describe('scanSwapBuckets — real block timestamps (S134e)', () => {
  it('assigns hours from REAL timestamps, not 2s cadence math', async () => {
    // T0 sits exactly on an hour boundary: real timestamps put block 100
    // in the PREVIOUS hour and block 101 in the next — two buckets. The
    // legacy 2s math would collapse both into one bucket at Date.now().
    const T0 = 1_800_000_000
    const client = makeTsClient({ 100: T0 - 10, 101: T0 + 10 }, [100, 101])

    const res = await scanSwapBuckets(
      client as never,
      VAULT,
      90,
      101,
      500,
      undefined,
      1_000,
      client as never
    )

    expect(res.buckets).toHaveLength(2)
    const hours = res.buckets.map(b => b.hour).sort((a, b) => a - b)
    expect(hours[0]).toBe(Math.floor(((T0 - 10) * 1_000) / HOUR))
    expect(hours[1]).toBe(Math.floor(((T0 + 10) * 1_000) / HOUR))
  })

  it('splits events into different hours when real timestamps say so', async () => {
    const T0 = 1_800_000_000
    const client = makeTsClient({ 100: T0, 101: T0 + 3_700 }, [100, 101])

    const res = await scanSwapBuckets(
      client as never,
      VAULT,
      90,
      101,
      500,
      undefined,
      1_000,
      client as never
    )

    expect(res.buckets).toHaveLength(2)
    expect(res.buckets[0]!.hour).not.toBe(res.buckets[1]!.hour)
  })

  it('falls back to 2s cadence math when no timestamp client is given', async () => {
    const client = {
      request: vi.fn(async ({ method }: { method: string }) =>
        method === 'eth_getLogs' ? [swapLog(100)] : []
      ),
    }

    const res = await scanSwapBuckets(client as never, VAULT, 90, 100, 500)
    expect(res.buckets).toHaveLength(1) // graceful fallback, never throws
  })

  it('skips a block whose timestamp probe fails and still decodes the rest', async () => {
    const T0 = 1_800_000_000
    const client = makeTsClient({ 100: T0 }, [100, 101]) // 101 probe -> null

    const res = await scanSwapBuckets(
      client as never,
      VAULT,
      90,
      101,
      500,
      undefined,
      1_000,
      client as never
    )

    expect(res.buckets).toHaveLength(1)
    expect(res.buckets[0]!.hour).toBe(Math.floor((T0 * 1_000) / HOUR))
  })
})

describe('measureBlockMs — live cadence probe (S134e)', () => {
  it('measures the real cadence from two block probes', async () => {
    const T0 = 1_800_000_000
    const client = makeTsClient({ 2_000: T0 + 200, 1_000: T0 })
    // 200s across 1000 blocks = 200ms/block (Sun Valley shape)
    expect(await measureBlockMs(client as never, 2_000, 1_000)).toBe(200)
  })

  it('returns the 2s legacy default when probes fail', async () => {
    const client = { request: vi.fn(async () => null) }
    expect(await measureBlockMs(client as never, 2_000, 1_000)).toBe(2_000)
  })

  it('returns the legacy default for a non-positive measurement', async () => {
    const client = makeTsClient({ 2_000: 100, 1_000: 200 }) // inverted -> negative
    expect(await measureBlockMs(client as never, 2_000, 1_000)).toBe(2_000)
  })
})
