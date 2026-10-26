import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDiscoveredPoolsStore,
  discoveredPoolsStoreKey,
  loadDiscoveredPoolsStore,
  mergeDiscoveredPoolsStore,
  saveDiscoveredPoolsStore,
  type DiscoveredPoolsStore,
} from './onchain-discovery-store'

/**
 * Persistent discovery store law: incremental scans must keep a
 * cumulative registry of discovered pools — a pool discovered before a
 * cache expiry must never vanish from discovery while it remains
 * registered on-chain. The static export has no server; localStorage is
 * the only persistent store available.
 */

const CHAIN_ID = 84532
const FROM_BLOCK = 46_984_000

function freshStore(): DiscoveredPoolsStore {
  return {
    version: 2,
    chainId: CHAIN_ID,
    fromBlock: FROM_BLOCK,
    cursor: FROM_BLOCK + 500,
    savedAt: 1_000,
    pools: {},
  }
}

const POOL_A = {
  address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  factory: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  blockNumber: FROM_BLOCK + 10,
}

beforeEach(() => {
  clearDiscoveredPoolsStore(CHAIN_ID)
})

describe('discovered pools store', () => {
  it('save -> load roundtrip preserves pools, cursor, and fromBlock', () => {
    const store = freshStore()
    store.pools[POOL_A.address.toLowerCase()] = POOL_A
    expect(saveDiscoveredPoolsStore(store)).toBe(true)

    const loaded = loadDiscoveredPoolsStore(CHAIN_ID, FROM_BLOCK)
    expect(loaded).not.toBeNull()
    expect(loaded!.cursor).toBe(store.cursor)
    expect(loaded!.savedAt).toBe(store.savedAt)
    expect(loaded!.pools[POOL_A.address.toLowerCase()]).toEqual(POOL_A)
  })

  it('merge adds new pools, advances the cursor, and lets a re-discovered address overwrite', () => {
    const merged = mergeDiscoveredPoolsStore(freshStore(), FROM_BLOCK + 900, [POOL_A])
    expect(merged.cursor).toBe(FROM_BLOCK + 900)
    expect(merged.pools[POOL_A.address.toLowerCase()]).toEqual(POOL_A)

    const rediscovered = { ...POOL_A, blockNumber: FROM_BLOCK + 30 }
    const merged2 = mergeDiscoveredPoolsStore(merged, FROM_BLOCK + 950, [rediscovered])
    expect(Object.keys(merged2.pools)).toHaveLength(1)
    expect(merged2.pools[POOL_A.address.toLowerCase()]!.blockNumber).toBe(FROM_BLOCK + 30)
  })

  it('merge never rewinds the cursor', () => {
    const store = freshStore() // cursor = FROM_BLOCK + 500
    const merged = mergeDiscoveredPoolsStore(store, FROM_BLOCK + 100, [POOL_A])
    expect(merged.cursor).toBe(FROM_BLOCK + 500)
  })

  it('load discards and removes a store whose fromBlock no longer matches the scan config', () => {
    const store = freshStore()
    store.pools[POOL_A.address.toLowerCase()] = POOL_A
    saveDiscoveredPoolsStore(store)

    // A vault redeployment moves the scan origin — the stale store is void.
    expect(loadDiscoveredPoolsStore(CHAIN_ID, FROM_BLOCK + 1)).toBeNull()
    expect(localStorage.getItem(discoveredPoolsStoreKey(CHAIN_ID))).toBeNull()
  })

  it('load discards corrupted JSON instead of throwing', () => {
    localStorage.setItem(discoveredPoolsStoreKey(CHAIN_ID), '{not json')
    expect(loadDiscoveredPoolsStore(CHAIN_ID, FROM_BLOCK)).toBeNull()
    expect(localStorage.getItem(discoveredPoolsStoreKey(CHAIN_ID))).toBeNull()
  })

  it('load discards a store with a wrong version or chain id', () => {
    localStorage.setItem(
      discoveredPoolsStoreKey(CHAIN_ID),
      JSON.stringify({ ...freshStore(), version: 3 })
    )

    expect(loadDiscoveredPoolsStore(CHAIN_ID, FROM_BLOCK)).toBeNull()

    localStorage.setItem(
      discoveredPoolsStoreKey(CHAIN_ID),
      JSON.stringify({ ...freshStore(), chainId: 8453 })
    )

    expect(loadDiscoveredPoolsStore(CHAIN_ID, FROM_BLOCK)).toBeNull()
  })

  it('clear removes the store for one chain without touching another', () => {
    const store = freshStore()
    store.pools[POOL_A.address.toLowerCase()] = POOL_A
    saveDiscoveredPoolsStore(store)

    const otherKey = discoveredPoolsStoreKey(8453)
    localStorage.setItem(otherKey, '{}')

    clearDiscoveredPoolsStore(CHAIN_ID)
    expect(localStorage.getItem(discoveredPoolsStoreKey(CHAIN_ID))).toBeNull()
    expect(localStorage.getItem(otherKey)).toBe('{}')
    localStorage.removeItem(otherKey)
  })
})

describe('enrichment-priority merge (auditor F-02, 2026-10-13)', () => {
  const ENRICHED_A = {
    ...POOL_A,
    name: 'Real Pool Name',
    symbol: 'RPN',
    tokens: [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ],
    enriched: true,
  }

  it('an unenriched re-scan never clobbers enriched metadata', () => {
    const store = freshStore()
    store.pools[ENRICHED_A.address.toLowerCase()] = ENRICHED_A

    const unenriched = {
      address: POOL_A.address,
      factory: POOL_A.factory,
      blockNumber: FROM_BLOCK + 99,
    }

    const merged = mergeDiscoveredPoolsStore(store, FROM_BLOCK + 999, [unenriched])
    const record = merged.pools[POOL_A.address.toLowerCase()]!
    expect(record.name).toBe('Real Pool Name')
    expect(record.symbol).toBe('RPN')
    expect(record.tokens).toHaveLength(2)
    expect(record.enriched).toBe(true)
    expect(record.blockNumber).toBe(FROM_BLOCK + 99)
  })

  it('an enriched re-scan overwrites (re-registration with fresh reads)', () => {
    const store = freshStore()
    store.pools[ENRICHED_A.address.toLowerCase()] = ENRICHED_A

    const refreshed = { ...ENRICHED_A, name: 'Newer Name', blockNumber: FROM_BLOCK + 100 }
    const merged = mergeDiscoveredPoolsStore(store, FROM_BLOCK + 1000, [refreshed])
    expect(merged.pools[POOL_A.address.toLowerCase()]!.name).toBe('Newer Name')
  })

  it('isEnrichedRecord: flag OR non-empty tokens (legacy stores self-heal)', async () => {
    const { isEnrichedRecord } = await import('./onchain-discovery-store')
    expect(isEnrichedRecord(ENRICHED_A)).toBe(true)

    expect(
      isEnrichedRecord({ ...POOL_A, tokens: ['0x1111111111111111111111111111111111111111'] })
    ).toBe(true)

    expect(isEnrichedRecord({ ...POOL_A })).toBe(false)
    expect(isEnrichedRecord({ ...POOL_A, tokens: [], enriched: false })).toBe(false)
  })
})

describe('discovery store - reorg-safe merge laws', () => {
  const HEAD = FROM_BLOCK + 600

  const ABOVE_HEAD = {
    address: '0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
    factory: POOL_A.factory,
    blockNumber: FROM_BLOCK + 900,
  }

  it('merge prunes existing records above the scanned head - a reorged-out registration never persists', () => {
    const store = freshStore()
    store.pools[POOL_A.address.toLowerCase()] = POOL_A
    store.pools[ABOVE_HEAD.address.toLowerCase()] = ABOVE_HEAD

    const merged = mergeDiscoveredPoolsStore(store, HEAD, [])
    expect(merged.pools[POOL_A.address.toLowerCase()]).toBeDefined()
    expect(merged.pools[ABOVE_HEAD.address.toLowerCase()]).toBeUndefined()
    expect(merged.cursor).toBe(HEAD)
  })

  it('merge drops incoming records above the scanned head - tip registrations wait for confirmation', () => {
    const merged = mergeDiscoveredPoolsStore(freshStore(), HEAD, [POOL_A, ABOVE_HEAD])
    expect(merged.pools[POOL_A.address.toLowerCase()]).toBeDefined()
    expect(merged.pools[ABOVE_HEAD.address.toLowerCase()]).toBeUndefined()
  })
})
