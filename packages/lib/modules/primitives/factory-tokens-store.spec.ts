import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllFactoryTokensStores,
  clearFactoryTokensStore,
  factoryTokensStoreKey,
  loadFactoryTokensStore,
  mergeFactoryTokensStore,
  saveFactoryTokensStore,
  type FactoryTokensStore,
} from './factory-tokens-store'

/**
 * Persistent factory-token store law: refreshes must scan only NEW blocks
 * (cursor + 1, never the factory deployment block again) and re-read ERC20
 * metadata only for NEW addresses — persisted metadata is immutable and
 * reused. A deployment-identity mismatch (factory redeploy) voids the store.
 */

// Deployment identity comes from the canonical config so the spec can never
// drift from the addresses the production scan actually uses.
import {
  FACTORY_SCAN_FROM_BLOCK,
  PRIMITIVES_CHAIN_ID,
  TOKEN_FACTORY,
  WRAPPER_FACTORY,
} from './primitives.config'

const IDENTITY = {
  chainId: PRIMITIVES_CHAIN_ID,
  tokenFactory: TOKEN_FACTORY,
  wrapperFactory: WRAPPER_FACTORY,
  fromBlock: FACTORY_SCAN_FROM_BLOCK,
}

function freshStore(): FactoryTokensStore {
  return {
    version: 1,
    chainId: IDENTITY.chainId,
    tokenFactory: IDENTITY.tokenFactory,
    wrapperFactory: IDENTITY.wrapperFactory,
    fromBlock: IDENTITY.fromBlock,
    cursor: IDENTITY.fromBlock + 500,
    savedAt: 1_000,
    tokens: {},
  }
}

const TOKEN_A = {
  address: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  blockNumber: IDENTITY.fromBlock + 10,
  name: 'Test Token',
  symbol: 'TT',
  decimals: 18,
}

beforeEach(() => {
  clearAllFactoryTokensStores()
})

describe('factory tokens store', () => {
  it('save -> load roundtrip preserves tokens, cursor, and identity', () => {
    const store = freshStore()
    store.tokens[TOKEN_A.address.toLowerCase()] = TOKEN_A
    expect(saveFactoryTokensStore(store)).toBe(true)

    const loaded = loadFactoryTokensStore(IDENTITY)
    expect(loaded).not.toBeNull()
    expect(loaded!.cursor).toBe(store.cursor)
    expect(loaded!.tokens[TOKEN_A.address.toLowerCase()]).toEqual(TOKEN_A)
  })

  it('merge adds new tokens with metadata, keeps persisted metadata for re-seen addresses', () => {
    const store = freshStore()
    store.tokens[TOKEN_A.address.toLowerCase()] = TOKEN_A

    // re-seen with NO metadata — persisted immutable metadata survives
    const reseen = { address: TOKEN_A.address, blockNumber: IDENTITY.fromBlock + 30 }

    const fresh = {
      address: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'.toUpperCase(),
      blockNumber: IDENTITY.fromBlock + 40,
      name: 'New',
      symbol: 'NW',
      decimals: 6,
    }

    const merged = mergeFactoryTokensStore(store, IDENTITY.fromBlock + 900, [reseen, fresh])

    expect(merged.cursor).toBe(IDENTITY.fromBlock + 900)

    expect(merged.tokens[TOKEN_A.address.toLowerCase()]).toEqual({
      ...TOKEN_A,
      blockNumber: reseen.blockNumber,
    })

    expect(merged.tokens[fresh.address.toLowerCase()]).toEqual(fresh)
  })

  it('merge never rewinds the cursor', () => {
    const merged = mergeFactoryTokensStore(freshStore(), IDENTITY.fromBlock + 100, [])
    expect(merged.cursor).toBe(IDENTITY.fromBlock + 500)
  })

  it('load discards and removes a store whose factory identity changed (redeploy voids it)', () => {
    const store = freshStore()
    store.tokens[TOKEN_A.address.toLowerCase()] = TOKEN_A
    saveFactoryTokensStore(store)

    const redeployed = { ...IDENTITY, tokenFactory: '0x0000000000000000000000000000000000000001' }
    expect(loadFactoryTokensStore(redeployed)).toBeNull()
    expect(localStorage.getItem(factoryTokensStoreKey(IDENTITY.chainId))).toBeNull()
  })

  it('load discards and removes a store whose fromBlock changed', () => {
    const store = freshStore()
    saveFactoryTokensStore(store)

    expect(loadFactoryTokensStore({ ...IDENTITY, fromBlock: IDENTITY.fromBlock + 1 })).toBeNull()
    expect(localStorage.getItem(factoryTokensStoreKey(IDENTITY.chainId))).toBeNull()
  })

  it('load discards corrupted JSON instead of throwing', () => {
    localStorage.setItem(factoryTokensStoreKey(IDENTITY.chainId), '{not json')
    expect(loadFactoryTokensStore(IDENTITY)).toBeNull()
    expect(localStorage.getItem(factoryTokensStoreKey(IDENTITY.chainId))).toBeNull()
  })

  it('load discards a wrong version or chain id', () => {
    localStorage.setItem(
      factoryTokensStoreKey(IDENTITY.chainId),
      JSON.stringify({ ...freshStore(), version: 2 })
    )

    expect(loadFactoryTokensStore(IDENTITY)).toBeNull()

    localStorage.setItem(
      factoryTokensStoreKey(IDENTITY.chainId),
      JSON.stringify({ ...freshStore(), chainId: 8453 })
    )

    expect(loadFactoryTokensStore(IDENTITY)).toBeNull()
  })

  it('clear removes one chain store without touching another', () => {
    const store = freshStore()
    saveFactoryTokensStore(store)

    const otherKey = factoryTokensStoreKey(8453)
    localStorage.setItem(otherKey, '{}')

    clearFactoryTokensStore(IDENTITY.chainId)
    expect(localStorage.getItem(factoryTokensStoreKey(IDENTITY.chainId))).toBeNull()
    expect(localStorage.getItem(otherKey)).toBe('{}')
    localStorage.removeItem(otherKey)
  })
})
