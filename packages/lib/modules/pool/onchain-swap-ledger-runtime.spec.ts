import { describe, expect, it, vi } from 'vitest'
import {
  SWAP_LEDGER_RUNTIME_URL,
  VOLUME_MAX_AGE_MS,
  fetchRuntimeSwapLedger,
  resolveEffectiveLedger,
} from './onchain-swap-ledger-runtime'
import type { SwapBucket } from './onchain-metrics'

/*
 * Runtime swap-ledger source (Boss fresh-data doctrine 2026-11-17).
 *
 * Laws:
 * - The orchard route is the PRIMARY ledger source; the baked file is a
 *   FALLBACK that must be flagged stale, never presented as current.
 * - Runtime buckets REPLACE baked buckets (both cover [deploy, X] — summing
 *   them double-counts every swap).
 * - Any fetch failure, non-200, malformed payload, or abort resolves to
 *   null so the caller falls back — never a throw into the render path.
 * - A ledger older than the volume ceiling is STALE: the display gate turns
 *   volume into an em-dash instead of a confident zero.
 */

const HOUR = 3_600_000
const NOW = 1_700_000_000_000

const bucket = (over: Partial<SwapBucket> = {}): SwapBucket => ({
  hour: Math.floor(NOW / HOUR),
  pool: '0xpool',
  token: '0xtoken',
  amountInRaw: '1000000000000000000',
  feeAmountRaw: '10000000000000000',
  ...over,
})

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

const fail = (status = 500) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) })

describe('fetchRuntimeSwapLedger — the primary source', () => {
  it('targets the orchard route over https, not iris', () => {
    expect(SWAP_LEDGER_RUNTIME_URL).toBe('https://orchard.basednut.com/api/swap-ledger')
  })

  it('returns buckets + freshness fields from a well-formed payload', async () => {
    const savedAt = new Date(NOW - HOUR).toISOString()

    const fetchImpl = vi.fn(() =>
      ok({ buckets: [bucket()], savedAt, cursor: 58_000_000, headBlock: 58_000_100, stale: false })
    )

    const out = await fetchRuntimeSwapLedger({ fetchImpl: fetchImpl as never, nowMs: NOW })

    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(out?.buckets).toHaveLength(1)
    expect(out?.savedAtMs).toBe(NOW - HOUR)
    expect(out?.cursor).toBe(58_000_000)
    expect(out?.stale).toBe(false)
  })

  it('resolves to null on a non-200 instead of throwing into the render path', async () => {
    const out = await fetchRuntimeSwapLedger({ fetchImpl: (() => fail(500)) as never })
    expect(out).toBeNull()
  })

  it('resolves to null when the fetch rejects (network / abort)', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('aborted')))
    const out = await fetchRuntimeSwapLedger({ fetchImpl: fetchImpl as never })
    expect(out).toBeNull()
  })

  it('rejects a malformed payload (no buckets array) rather than trusting it', async () => {
    const out = await fetchRuntimeSwapLedger({
      fetchImpl: (() => ok({ savedAt: '2026-11-17' })) as never,
    })

    expect(out).toBeNull()
  })

  it('rejects a bucket with an unusable shape', async () => {
    const out = await fetchRuntimeSwapLedger({
      fetchImpl: (() => ok({ buckets: [{ hour: 'nope' }] })) as never,
    })

    expect(out).toBeNull()
  })

  it('parses a numeric savedAt (epoch ms) as well as ISO', async () => {
    const out = await fetchRuntimeSwapLedger({
      fetchImpl: (() => ok({ buckets: [bucket()], savedAt: NOW - 1000 })) as never,
      nowMs: NOW,
    })

    expect(out?.savedAtMs).toBe(NOW - 1000)
  })
})

describe('resolveEffectiveLedger — runtime primary, baked flagged fallback', () => {
  const fresh = { buckets: [bucket({ token: '0xruntime' })], savedAtMs: NOW - HOUR, stale: false }
  const baked = { buckets: [bucket({ token: '0xbaked' })], savedAtMs: NOW - 11 * 24 * HOUR }

  it('runtime REPLACES baked — never sums overlapping ranges', () => {
    const out = resolveEffectiveLedger({ runtime: fresh, baked, nowMs: NOW })

    expect(out.source).toBe('runtime')
    expect(out.buckets).toHaveLength(1)
    expect(out.buckets[0]!.token).toBe('0xruntime')
    expect(out.stale).toBe(false)
    expect(out.coverage?.savedAtMs).toBe(NOW - HOUR)
  })

  it('falls back to baked and FLAGS it stale when the runtime source is missing', () => {
    const out = resolveEffectiveLedger({ runtime: null, baked, nowMs: NOW })

    expect(out.source).toBe('baked')
    expect(out.stale).toBe(true)
    expect(out.buckets[0]!.token).toBe('0xbaked')
  })

  it('honours the server stale flag even when savedAt looks recent', () => {
    const out = resolveEffectiveLedger({
      runtime: { ...fresh, stale: true, savedAtMs: NOW - HOUR },
      baked,
      nowMs: NOW,
    })

    expect(out.stale).toBe(true)
  })

  it('treats a runtime ledger past the ceiling as stale', () => {
    const out = resolveEffectiveLedger({
      runtime: { ...fresh, savedAtMs: NOW - VOLUME_MAX_AGE_MS - 1 },
      baked: null,
      nowMs: NOW,
    })

    expect(out.stale).toBe(true)
  })

  it('no sources -> none, empty buckets, stale', () => {
    const out = resolveEffectiveLedger({ runtime: null, baked: null, nowMs: NOW })

    expect(out.source).toBe('none')
    expect(out.buckets).toEqual([])
    expect(out.stale).toBe(true)
    expect(out.coverage).toBeUndefined()
  })
})
