/**
 * Pool-activity events store — persistent localStorage per pool (B4).
 *
 * Pattern: onchain-metrics-store.ts (envelope validated on load; a store
 * whose version/chainId/pool no longer matches is void and removed).
 *
 * Holds raw BakedPoolEvent-shaped activity entries + a block cursor for ONE
 * pool. The baked events artifact (generate-baked-pool-events.mjs) seeds the
 * full history; the visitor scan extends it from the farthest cursor. All
 * sources are disjoint block ranges by construction — merge is a safety
 * dedupe (type:tx:logIndex), never a re-count.
 */

import type { BakedPoolEvent } from './onchain-pool-events-builder'

export const ACTIVITY_STORE_VERSION = 1

/** Keep the newest N events per pool — matches the activity table window. */
export const ACTIVITY_MAX_EVENTS = 500

export interface ActivityStore {
  version: number
  chainId: number
  poolId: string
  /** Latest block contiguously covered (inclusive). Monotonic. */
  cursor: number
  savedAt: number
  events: BakedPoolEvent[]
}

const KEY = (chainId: number, poolId: string) =>
  `rootstock.pool-activity.${chainId}.${poolId.toLowerCase()}`

export function loadActivityStore(chainId: number, poolId: string): ActivityStore | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(KEY(chainId, poolId))
    if (!raw) return null
    const store = JSON.parse(raw) as ActivityStore

    if (
      store?.version !== ACTIVITY_STORE_VERSION ||
      store?.chainId !== chainId ||
      typeof store?.poolId !== 'string' ||
      store?.poolId.toLowerCase() !== poolId.toLowerCase() ||
      !Array.isArray(store?.events) ||
      typeof store?.cursor !== 'number'
    ) {
      localStorage.removeItem(KEY(chainId, poolId))
      return null
    }

    return store
  } catch {
    return null
  }
}

export function saveActivityStore(store: ActivityStore): void {
  if (typeof localStorage === 'undefined') return

  try {
    // newest-first retention: the table shows newest events; overflow drops
    // the oldest, never the fresh tail the cursor just covered.
    const events = [...store.events].sort((a, b) => b.timestamp - a.timestamp)
    const pruned = events.slice(0, ACTIVITY_MAX_EVENTS)

    localStorage.setItem(
      KEY(store.chainId, store.poolId),
      JSON.stringify({ ...store, events: pruned })
    )
  } catch {
    // quota / private mode — in-memory result still returns
  }
}

/**
 * Dedupe-merge activity events by (type, tx, logIndex). Sources are disjoint
 * block ranges by construction; identical keys can only appear when a
 * re-bake overlaps an older visitor store — the key collapse keeps one.
 */
export function mergeActivityEvents(a: BakedPoolEvent[], b: BakedPoolEvent[]): BakedPoolEvent[] {
  const byKey = new Map<string, BakedPoolEvent>()

  for (const e of [...a, ...b]) {
    const key = `${e.type}:${(e.tx || '').toLowerCase()}:${e.logIndex ?? ''}`
    if (!byKey.has(key)) byKey.set(key, e)
  }

  return [...byKey.values()].sort((x, y) => y.timestamp - x.timestamp)
}

/**
 * Re-bake absorption law (B4): the visitor store covers the range AFTER the
 * bake that seeded it. When a NEW bake's cursor passes the store's cursor,
 * the bake has absorbed the store's whole range — the store is redundant
 * (merging it would duplicate events) and must be dropped.
 */
export function reconcileActivityStore(
  store: ActivityStore | null,
  bakedCursor: number
): ActivityStore | null {
  if (!store) return null
  return store.cursor > bakedCursor ? store : null
}
