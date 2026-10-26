import type { DiscoveredPoolToken } from './onchain-pool-discovery'

/**
 * Persistent onchain discovery store — the cumulative registry of
 * discovered pools (per chain) that survives cache expiry, reloads, and
 * cold starts.
 *
 * Law (auditor finding): an incremental cursor alone loses pools — a pool
 * discovered in a previous session vanishes from discovery after the
 * 5-minute cache expiry if it is absent from the baked registry, even
 * while it remains registered on-chain. The static export has no server;
 * localStorage is the only persistent store available.
 *
 * Envelope is validated on load: a store whose version, chainId, or
 * fromBlock no longer matches the live scan config is void and removed —
 * never a silently wrong pool list after a vault redeployment.
 */

// v2 (2026-10-26): records gain hook/tags (display facts). A version bump
// voids legacy stores — the next scan rebuilds every record with the new
// schema (no half-migrated records: old records lack hook facts and the
// incremental cursor would never re-read them).
export const DISCOVERED_POOLS_STORE_VERSION = 2

/** A discovered pool — registry facts + any metadata the scan enriched. */
export interface DiscoveredPoolRecord {
  address: string
  factory: string
  blockNumber: number
  /** Enriched metadata (persisted so reloads render without re-reads). */
  name?: string
  symbol?: string
  tokens?: (string | DiscoveredPoolToken)[]
  /** True when the metadata reads succeeded (F-02). Legacy records without
   *  the flag self-heal via non-empty tokens in isEnrichedRecord. */
  enriched?: boolean
  /** External hook contract address; null = none (v2 display facts). */
  hook?: string | null
  /** Derived display tags — BOOSTED (v2 display facts). */
  tags?: string[]
}

/**
 * F-02 (2026-10-13): a record is complete when its enrichment reads
 * succeeded — the explicit flag, OR non-empty tokens (legacy stores that
 * predate the flag). Incomplete records are re-read on every later scan
 * until they heal; they are never silently frozen.
 */
export function isEnrichedRecord(record: DiscoveredPoolRecord): boolean {
  return record.enriched === true || (record.tokens?.length ?? 0) > 0
}

export interface DiscoveredPoolsStore {
  version: number
  chainId: number
  /** Scan origin — must match the live scan config or the store is void. */
  fromBlock: number
  /** Latest block fully scanned (inclusive). Monotonic. */
  cursor: number
  /** Epoch ms of the last save. */
  savedAt: number
  /** Cumulative discovered pools, keyed by lowercase address. */
  pools: Record<string, DiscoveredPoolRecord>
}

export function discoveredPoolsStoreKey(chainId: number): string {
  return `rootstock:pools:v${DISCOVERED_POOLS_STORE_VERSION}:${chainId}`
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function isValidStore(
  value: unknown,
  chainId: number,
  fromBlock: number
): value is DiscoveredPoolsStore {
  if (typeof value !== 'object' || value === null) return false

  const store = value as Partial<DiscoveredPoolsStore>

  return (
    store.version === DISCOVERED_POOLS_STORE_VERSION &&
    store.chainId === chainId &&
    store.fromBlock === fromBlock &&
    typeof store.cursor === 'number' &&
    typeof store.savedAt === 'number' &&
    typeof store.pools === 'object' &&
    store.pools !== null
  )
}

/**
 * Load the persisted store for a chain. Returns null (and removes the
 * persisted entry) when the store is corrupted, malformed, or recorded
 * against a different scan origin. SSR/test environments without
 * localStorage return null without touching anything.
 */
export function loadDiscoveredPoolsStore(
  chainId: number,
  fromBlock: number
): DiscoveredPoolsStore | null {
  if (!hasLocalStorage()) return null

  const key = discoveredPoolsStoreKey(chainId)

  let raw: string | null

  try {
    raw = localStorage.getItem(key)
  } catch {
    return null
  }

  if (raw === null) return null

  try {
    const parsed: unknown = JSON.parse(raw)

    if (isValidStore(parsed, chainId, fromBlock)) {
      return parsed
    }
  } catch {
    // corrupted JSON — fall through to removal
  }

  try {
    localStorage.removeItem(key)
  } catch {
    // removal failure is non-fatal — the store is ignored either way
  }

  return null
}

/** Persist a store. Returns true when written, false when storage is
 * unavailable (SSR/tests keep current behavior — baked registry only). */
export function saveDiscoveredPoolsStore(store: DiscoveredPoolsStore): boolean {
  if (!hasLocalStorage()) return false

  try {
    localStorage.setItem(discoveredPoolsStoreKey(store.chainId), JSON.stringify(store))
    return true
  } catch {
    // quota exceeded or storage disabled — discovery still works in-memory
    return false
  }
}

/** Remove the persisted store for one chain (corruption reset, tests). */
export function clearDiscoveredPoolsStore(chainId: number): void {
  if (!hasLocalStorage()) return

  try {
    localStorage.removeItem(discoveredPoolsStoreKey(chainId))
  } catch {
    // ignore
  }
}

/** Remove every persisted discovery store (test isolation, schema reset). */
export function clearAllDiscoveredPoolsStores(): void {
  if (!hasLocalStorage()) return

  try {
    const prefix = 'rootstock:pools:'
    const toRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) toRemove.push(key)
    }

    for (const key of toRemove) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/**
 * Merge freshly scanned pools into a store: add new addresses, let a
 * re-discovered address overwrite (re-registration updates the record),
 * and advance the cursor to the scanned head — never backwards. The
 * result is unsaved; the caller persists it after the merge.
 */
export function mergeDiscoveredPoolsStore(
  store: DiscoveredPoolsStore,
  scannedToBlock: number,
  pools: DiscoveredPoolRecord[]
): DiscoveredPoolsStore {
  const merged: DiscoveredPoolsStore = {
    ...store,
    pools: { ...store.pools },
    cursor: Math.max(store.cursor, scannedToBlock),
    savedAt: Date.now(),
  }

  // Reorg-safe merge: records above the scanned (finalized) head are
  // dropped - a reorged-out registration never persists.
  for (const key of Object.keys(merged.pools)) {
    const record = merged.pools[key]
    if (record && record.blockNumber > scannedToBlock) delete merged.pools[key]
  }

  for (const pool of pools) {
    // tip registrations wait for a confirmed scan - never persist above head
    if (pool.blockNumber > scannedToBlock) continue

    const key = pool.address.toLowerCase()
    const prev = merged.pools[key]

    // F-02 (2026-10-13) enrichment priority: an UNenriched re-scan (its
    // metadata reads failed) never clobbers enriched metadata already
    // stored — only the registry facts (factory, blockNumber) update, so
    // a transient RPC failure cannot permanently blank a known pool.
    // An enriched record always overwrites in full.
    if (prev && !isEnrichedRecord(pool) && isEnrichedRecord(prev)) {
      merged.pools[key] = {
        address: pool.address,
        factory: pool.factory,
        blockNumber: pool.blockNumber,
        name: prev.name,
        symbol: prev.symbol,
        tokens: prev.tokens,
        enriched: prev.enriched,
        hook: prev.hook,
        tags: prev.tags,
      }
    } else {
      merged.pools[key] = {
        address: pool.address,
        factory: pool.factory,
        blockNumber: pool.blockNumber,
        name: pool.name,
        symbol: pool.symbol,
        tokens: pool.tokens,
        enriched: pool.enriched,
        hook: pool.hook,
        tags: pool.tags,
      }
    }
  }

  return merged
}
