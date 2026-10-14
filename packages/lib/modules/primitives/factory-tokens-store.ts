/**
 * Persistent factory-token discovery store — the cumulative registry of
 * factory-created tokens and wrappers (per chain) that survives cache
 * expiry, reloads, and cold starts.
 *
 * Law (auditor finding): every factory-token refresh rescanned from the
 * factory deployment block — repeated full-history scans against a
 * rate-limited public RPC for metadata that never changes. The persisted
 * store carries the incremental cursor + the immutable token metadata so
 * refreshes scan only NEW blocks and re-read metadata only for NEW
 * addresses.
 *
 * Envelope is validated on load: a store whose version, chainId, factory
 * addresses, or fromBlock no longer match the live deployment config is
 * void and removed — never silently wrong metadata after a factory
 * redeployment.
 */

export const FACTORY_TOKENS_STORE_VERSION = 1

/** A factory-created token — registry facts + immutable ERC20 metadata. */
export interface FactoryTokenRecord {
  address: string
  blockNumber: number
  name?: string
  symbol?: string
  decimals?: number
}

export interface FactoryTokensStore {
  version: number
  chainId: number
  /** Deployment identity — a mismatch voids the store. */
  tokenFactory: string
  wrapperFactory: string
  fromBlock: number
  /** Latest block fully scanned (inclusive). Monotonic. */
  cursor: number
  /** Epoch ms of the last save. */
  savedAt: number
  /** Cumulative discovered tokens, keyed by lowercase address. */
  tokens: Record<string, FactoryTokenRecord>
}

export function factoryTokensStoreKey(chainId: number): string {
  return `rootstock:primitives:v${FACTORY_TOKENS_STORE_VERSION}:${chainId}`
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

export interface FactoryTokensStoreIdentity {
  chainId: number
  tokenFactory: string
  wrapperFactory: string
  fromBlock: number
}

function sameIdentity(
  store: Partial<FactoryTokensStore>,
  identity: FactoryTokensStoreIdentity
): boolean {
  return (
    store.chainId === identity.chainId &&
    store.tokenFactory?.toLowerCase() === identity.tokenFactory.toLowerCase() &&
    store.wrapperFactory?.toLowerCase() === identity.wrapperFactory.toLowerCase() &&
    store.fromBlock === identity.fromBlock
  )
}

function isValidStore(
  value: unknown,
  identity: FactoryTokensStoreIdentity
): value is FactoryTokensStore {
  if (typeof value !== 'object' || value === null) return false

  const store = value as Partial<FactoryTokensStore>

  return (
    store.version === FACTORY_TOKENS_STORE_VERSION &&
    sameIdentity(store, identity) &&
    typeof store.cursor === 'number' &&
    typeof store.savedAt === 'number' &&
    typeof store.tokens === 'object' &&
    store.tokens !== null
  )
}

/**
 * Load the persisted store for a chain. Returns null (and removes the
 * persisted entry) when the store is corrupted, malformed, or recorded
 * against a different deployment. SSR/test environments without
 * localStorage return null without touching anything.
 */
export function loadFactoryTokensStore(
  identity: FactoryTokensStoreIdentity
): FactoryTokensStore | null {
  if (!hasLocalStorage()) return null

  const key = factoryTokensStoreKey(identity.chainId)

  let raw: string | null

  try {
    raw = localStorage.getItem(key)
  } catch {
    return null
  }

  if (raw === null) return null

  try {
    const parsed: unknown = JSON.parse(raw)

    if (isValidStore(parsed, identity)) {
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
 * unavailable. Persistence failure never breaks discovery. */
export function saveFactoryTokensStore(store: FactoryTokensStore): boolean {
  if (!hasLocalStorage()) return false

  try {
    localStorage.setItem(factoryTokensStoreKey(store.chainId), JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

/** Remove the persisted store for one chain (corruption reset, tests). */
export function clearFactoryTokensStore(chainId: number): void {
  if (!hasLocalStorage()) return

  try {
    localStorage.removeItem(factoryTokensStoreKey(chainId))
  } catch {
    // ignore
  }
}

/** Remove every persisted factory-token store (test isolation). */
export function clearAllFactoryTokensStores(): void {
  if (!hasLocalStorage()) return

  try {
    const prefix = 'rootstock:primitives:'
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
 * Merge freshly scanned creations into a store: new addresses join with
 * their metadata, re-seen addresses keep persisted metadata (ERC20
 * name/symbol/decimals are immutable — a fresh read is wasted RPC), and
 * the cursor advances to the scanned head — never backwards. The result
 * is unsaved; the caller persists it after the merge.
 */
export function mergeFactoryTokensStore(
  store: FactoryTokensStore,
  scannedToBlock: number,
  fresh: FactoryTokenRecord[]
): FactoryTokensStore {
  const merged: FactoryTokensStore = {
    ...store,
    tokens: { ...store.tokens },
    cursor: Math.max(store.cursor, scannedToBlock),
    savedAt: Date.now(),
  }

  for (const token of fresh) {
    const key = token.address.toLowerCase()
    const known = merged.tokens[key]
    const incomingComplete = !!token.name && !!token.symbol && typeof token.decimals === 'number'

    merged.tokens[key] =
      known && !incomingComplete
        ? { ...known, blockNumber: token.blockNumber } // incoming incomplete — keep persisted metadata
        : token // incoming complete (or no known record) — incoming wins
  }

  return merged
}
