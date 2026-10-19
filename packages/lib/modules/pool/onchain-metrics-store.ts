/**
 * Swap-event metrics ledger — persistent localStorage store.
 *
 * Pattern: onchain-discovery-store.ts (envelope validated on load; a
 * store whose version/chainId no longer matches is void and removed).
 *
 * The ledger holds hourly swap buckets + a block cursor. The baked
 * histogram (generated at build time via archive RPC) seeds cold starts;
 * visitor scans extend it. hasFullCoverage is true only when the baked
 * base covers the whole trailing-24h window OR the visitor cursor has
 * run continuously since ≥24h ago (max(savedAt) - min gap check kept
 * simple: cursor age >= 24h with savedAt freshness).
 */

import type { SwapBucket } from './onchain-metrics'

export const SWAP_LEDGER_STORE_VERSION = 1
/** Prune buckets older than this (hours) — the display window is 24h. */
export const LEDGER_RETENTION_HOURS = 48

export interface SwapLedgerStore {
  version: number
  chainId: number
  /** Latest block scanned (inclusive). Monotonic. */
  cursor: number
  /** Epoch ms of the last save. */
  savedAt: number
  buckets: SwapBucket[]
}

const KEY = (chainId: number) => `rootstock.swap-ledger.${chainId}`

export function loadSwapLedger(chainId: number): SwapLedgerStore | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(KEY(chainId))
    if (!raw) return null
    const store = JSON.parse(raw) as SwapLedgerStore

    if (
      store?.version !== SWAP_LEDGER_STORE_VERSION ||
      store?.chainId !== chainId ||
      !Array.isArray(store?.buckets) ||
      typeof store?.cursor !== 'number'
    ) {
      localStorage.removeItem(KEY(chainId))
      return null
    }

    return store
  } catch {
    return null
  }
}

export function saveSwapLedger(store: SwapLedgerStore): void {
  if (typeof localStorage === 'undefined') return

  try {
    const hourFloor = Math.floor(Date.now() / 3_600_000) - LEDGER_RETENTION_HOURS
    const pruned = store.buckets.filter(b => b.hour >= hourFloor)

    localStorage.setItem(
      KEY(store.chainId),
      JSON.stringify({ ...store, buckets: pruned })
    )
  } catch {
    // quota / private mode — in-memory result still returns
  }
}

/** Merge two bucket lists (dedupe by hour|pool|token, later value wins). */
export function mergeBuckets(a: SwapBucket[], b: SwapBucket[]): SwapBucket[] {
  const map = new Map<string, SwapBucket>()

  for (const bucket of [...a, ...b]) {
    const key = `${bucket.hour}|${bucket.pool}|${bucket.token}`
    map.set(key, bucket)
  }

  return [...map.values()]
}

/**
 * Coverage: the ledger covers the trailing 24h when the oldest retained
 * bucket-hour (or a known coverageStart) precedes now-24h. A ledger
 * born mid-window (cold start without baked base) never claims full
 * coverage until it has lived 24h.
 */
export function hasLedgerFullCoverage(
  store: SwapLedgerStore | null,
  bakedCoverageStartMs: number | null,
  now: number
): boolean {
  const cutoff = now - 24 * 3_600_000
  if (bakedCoverageStartMs !== null && bakedCoverageStartMs <= cutoff) return true
  if (!store) return false

  // visitor-ledger-only coverage: savedAt fresh (≤1h) and cursor born
  // before cutoff — approximated by the earliest bucket OR first-save
  // marker stored in savedAt chain… we conservatively require buckets
  // spanning past the cutoff.
  const earliest = store.buckets.reduce(
    (min, b) => Math.min(min, b.hour * 3_600_000),
    Number.POSITIVE_INFINITY
  )

  return now - store.savedAt <= 3_600_000 && earliest <= cutoff
}
