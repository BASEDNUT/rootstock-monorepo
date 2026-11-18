/**
 * Runtime swap-ledger source — the orchard route (Boss fresh-data doctrine
 * 2026-11-17).
 *
 * The baked `baked-swap-ledger-base.json` is a BUILD-TIME archive scan. It was
 * 10.9 days stale on 2026-11-18 while the chain tip kept moving, and the list
 * volume anchors to the ledger data end — so an aged bake prints a confident
 * $0.00 for pools that traded (metrics-codepath.md, MEASURED).
 *
 * The orchard route serves a schema-compatible ledger with freshness fields.
 * It is the PRIMARY source; the bake is a FALLBACK that must be flagged, never
 * presented as current.
 *
 * Laws:
 * - Runtime REPLACES baked — never sum-merges. Both describe [deploy, X], so
 *   summing double-counts every swap.
 * - Any failure (non-200, malformed payload, abort, network) resolves to
 *   null — a fetch problem degrades to the bake, never throws into render.
 * - Staleness has two independent triggers: the server's own flag, and the
 *   savedAt age past the volume ceiling. Neither may be ignored.
 * - Never fabricate: a payload we cannot validate is absent, not guessed.
 */

import type { SwapBucket } from './onchain-metrics'
import { VOLUME_MAX_AGE_MS } from './onchain-yield-windows'

/**
 * The orchard ledger route. HTTPS, cert-valid, same-origin-class as the app.
 * Config constant so tests pin the contract instead of a literal at call site.
 */
export const SWAP_LEDGER_RUNTIME_URL = 'https://orchard.basednut.com/api/swap-ledger'

/**
 * Boss doctrine ceiling, re-exported from the gate owner so the runtime source
 * and the display gate can never drift apart: a visitor opens the site and
 * sees fresh data, the daily bake is the floor, 48h is the hard ceiling. Past
 * it volume dashes rather than claiming a zero.
 */
export { VOLUME_MAX_AGE_MS }

/** Fetch budget — the ledger is a small JSON; slow means unavailable. */
const DEFAULT_TIMEOUT_MS = 3_000

/** One validated runtime ledger. */
export interface RuntimeSwapLedger {
  buckets: SwapBucket[]
  /** Epoch ms of the served snapshot. */
  savedAtMs: number
  /** Last block the payload covers, when served. */
  cursor?: number
  /** Server-declared staleness — honoured even if savedAt looks recent. */
  stale: boolean
}

/** The bake, as the hook holds it (chain-selected JSON import). */
export interface BakedSwapLedger {
  buckets: SwapBucket[]
  savedAtMs: number
  coverageStartMs?: number
}

export type LedgerSource = 'runtime' | 'baked' | 'none'

export interface EffectiveLedger {
  source: LedgerSource
  buckets: SwapBucket[]
  /** True when the displayed numbers are NOT current truth. */
  stale: boolean
  /** Envelope for the window math, when a source provided one. */
  coverage?: { startMs: number; savedAtMs: number }
}

interface FetchOptions {
  /** Injectable fetch (tests). */
  fetchImpl?: typeof fetch
  /** Injectable clock (tests). */
  nowMs?: number
  /** Override the fetch budget. */
  timeoutMs?: number
}

function isSwapBucket(value: unknown): value is SwapBucket {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>

  return (
    typeof b.hour === 'number' &&
    Number.isFinite(b.hour) &&
    typeof b.pool === 'string' &&
    typeof b.token === 'string' &&
    typeof b.amountInRaw === 'string' &&
    typeof b.feeAmountRaw === 'string'
  )
}

/** ISO string or epoch ms -> epoch ms, or null when unusable. */
function parseSavedAt(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw

  if (typeof raw === 'string' && raw.length > 0) {
    const parsed = Date.parse(raw)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

/**
 * Fetch the runtime ledger, defensively parsed.
 *
 * Returns null for every failure mode. The caller must treat null as "fall
 * back to the bake, flagged stale" — never as "no volume happened".
 */
export async function fetchRuntimeSwapLedger(
  options: FetchOptions = {}
): Promise<RuntimeSwapLedger | null> {
  const doFetch = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (typeof doFetch !== 'function') return null

  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined

  try {
    const response = await doFetch(SWAP_LEDGER_RUNTIME_URL, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller?.signal,
    })

    if (!response || !response.ok) return null

    const payload = (await response.json()) as Record<string, unknown>
    if (typeof payload !== 'object' || payload === null) return null

    const rawBuckets = payload.buckets
    if (!Array.isArray(rawBuckets)) return null
    // One unusable bucket poisons every window sum — reject the payload and
    // fall back rather than silently dropping rows.
    if (!rawBuckets.every(isSwapBucket)) return null

    const savedAtMs = parseSavedAt(payload.savedAt)
    if (savedAtMs === null) return null

    const cursor =
      typeof payload.cursor === 'number' && Number.isFinite(payload.cursor)
        ? payload.cursor
        : undefined

    return {
      buckets: rawBuckets,
      savedAtMs,
      cursor,
      stale: payload.stale === true,
    }
  } catch {
    return null
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * Decide which ledger the display should use, and whether it is trustworthy.
 *
 * Runtime wins outright when present (replace, never merge). The bake is used
 * only as a flagged fallback. "stale" is the union of the server flag, the
 * age ceiling, and source absence.
 */
export function resolveEffectiveLedger({
  runtime,
  baked,
  nowMs,
  maxAgeMs = VOLUME_MAX_AGE_MS,
}: {
  runtime: RuntimeSwapLedger | null
  baked: BakedSwapLedger | null
  nowMs: number
  maxAgeMs?: number
}): EffectiveLedger {
  if (runtime) {
    const tooOld = nowMs - runtime.savedAtMs > maxAgeMs

    return {
      source: 'runtime',
      buckets: runtime.buckets,
      stale: runtime.stale || tooOld,
      coverage: { startMs: runtime.savedAtMs, savedAtMs: runtime.savedAtMs },
    }
  }

  if (baked) {
    return {
      source: 'baked',
      buckets: baked.buckets,
      // a bake is a fallback by definition: always flagged, age aside
      stale: true,
      coverage: {
        startMs: baked.coverageStartMs ?? baked.savedAtMs,
        savedAtMs: baked.savedAtMs,
      },
    }
  }

  return { source: 'none', buckets: [], stale: true }
}
