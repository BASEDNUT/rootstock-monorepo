/**
 * Swap-event metrics ledger — persistent localStorage store.
 *
 * Pattern: onchain-discovery-store.ts (envelope validated on load; a
 * store whose version/chainId no longer matches is void and removed).
 *
 * The ledger holds hourly swap buckets + a block cursor. The baked
 * histogram (generated at build time via archive RPC) seeds cold starts;
 * visitor scans extend it.
 *
 * B3 (live-caught 2026-10-21): the v1 gate granted full 24h coverage from
 * baked coverageStartMs ALONE — coverage-start says when history BEGINS,
 * not that the trailing window is gap-free. The baked cursor froze days
 * earlier and the visitor scan only reaches ~latest-10k blocks (publicnode
 * archive wall, live-probed), so swaps in the gap silently rendered as
 * genuine $0.00 while coverage was claimed. v2: coverage is continuous
 * only from the persisted coverageStartBlock (a scan that bridges the
 * baked cursor extends it backward to the baked coverage start); the
 * window is covered only when that start precedes the 24h cutoff, with a
 * fresh savedAt and a cursor at the chain tip.
 */

import type { SwapBucket } from './onchain-metrics'

export const SWAP_LEDGER_STORE_VERSION = 3
// v3 (2026-10-27, D3): buckets are VISITOR-SCAN ONLY — the baked ledger
// is merged at display time, never persisted here. v2 stores contained
// the baked buckets merged in (later-wins replace era); under sum-merge
// semantics re-merging them would DOUBLE-COUNT baked history, so v2
// stores are voided on load and rebuilt from a fresh window scan.
// v3 also pairs with the coveredTo cursor law: the cursor only advances
// over the contiguous run (holes re-attempt next scan).
/** Prune buckets older than this (hours) — the display window is 24h. */
export const LEDGER_RETENTION_HOURS = 48

export interface SwapLedgerStore {
  version: number
  chainId: number
  /** Latest block scanned (inclusive). Monotonic. */
  cursor: number
  /** Epoch ms of the last save. */
  savedAt: number
  /**
   * Oldest block this ledger covers CONTINUOUSLY (B3). A scan that starts
   * before the previous start extends coverage backward (min semantics);
   * an unbridged scan restarts coverage at its own fromBlock.
   */
  coverageStartBlock: number
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
      typeof store?.cursor !== 'number' ||
      typeof store?.coverageStartBlock !== 'number'
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

    localStorage.setItem(KEY(store.chainId), JSON.stringify({ ...store, buckets: pruned }))
  } catch {
    // quota / private mode — in-memory result still returns
  }
}

/**
 * Merge two bucket lists by hour|pool|token key with SUM semantics (D3,
 * live-caught 2026-10-27): all ledger sources are disjoint block ranges
 * by construction (baked covers [deploy, bakedCursor]; the visitor scan
 * starts at max(all cursors) + 1), so two buckets sharing a key are always
 * DIFFERENT events in the same hour — the old later-wins merge silently
 * dropped the pre-cursor side (visitor bucket replaced baked swaps in a
 * straddling hour). Sum never double-counts: no source can re-cover a
 * range another source already scanned.
 */
export function mergeBuckets(a: SwapBucket[], b: SwapBucket[]): SwapBucket[] {
  const map = new Map<string, SwapBucket>()

  for (const bucket of [...a, ...b]) {
    const key = `${bucket.hour}|${bucket.pool}|${bucket.token}`
    const existing = map.get(key)

    if (existing) {
      map.set(key, {
        ...existing,
        amountInRaw: (BigInt(existing.amountInRaw) + BigInt(bucket.amountInRaw)).toString(),
        feeAmountRaw: (BigInt(existing.feeAmountRaw) + BigInt(bucket.feeAmountRaw)).toString(),
      })
    } else {
      map.set(key, { ...bucket })
    }
  }

  return [...map.values()]
}

/**
 * Compute the continuous-coverage start block for a scan (B3).
 * - A scan CONTINUES the previous ledger iff fromBlock <= previous.cursor + 1
 *   (no gap) — then coverage extends backward to min(previous start, fromBlock).
 * - A scan with a previous-cursor GAP restarts coverage at its own fromBlock.
 * - A scan that bridges the baked cursor (fromBlock <= baked.cursor + 1)
 *   extends coverage backward to the BAKED coverage start.
 */
export function computeCoverageStartBlock({
  previous,
  fromBlock,
  bridgesBaked,
  bakedCoverageStartBlock,
}: {
  previous: { startBlock: number; cursor: number } | undefined
  fromBlock: number
  bridgesBaked: boolean
  bakedCoverageStartBlock: number | undefined
}): number {
  let start = fromBlock

  if (previous && fromBlock <= previous.cursor + 1) {
    start = Math.min(previous.startBlock, fromBlock)
  }

  if (bridgesBaked && bakedCoverageStartBlock !== undefined) {
    start = Math.min(start, bakedCoverageStartBlock)
  }

  return start
}

/**
 * Honest window-coverage gate (B3): the trailing 24h is covered only when
 * continuous coverage (coverageStartBlock) precedes the cutoff block AND
 * the ledger is fresh (savedAt ≤ 1h) AND the cursor is at the chain tip
 * (no unscanned tail). Baked data alone NEVER claims the window.
 */
export function hasLedgerFullCoverage(
  store: SwapLedgerStore | null,
  baked: { cursor: number; coverageStartMs: number } | null,
  latest: number,
  now: number,
  blockMs: number
): boolean {
  if (!store) return false
  if (typeof store.coverageStartBlock !== 'number') return false

  const cutoffBlock = latest - (24 * 3_600_000) / blockMs
  const coverageFresh = now - store.savedAt <= 3_600_000
  const cursorAtTip = latest - store.cursor <= 1_000
  const coverageFromCutoff = store.coverageStartBlock <= cutoffBlock

  // unused bake input kept in the signature for callers carrying it;
  // coverageStartMs alone never grants window coverage anymore.
  void baked

  return coverageFresh && cursorAtTip && coverageFromCutoff
}
