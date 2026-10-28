import { describe, expect, it } from 'vitest'
import { isMockPoolAddress, isMockPoolRecord, getBakedPools } from './onchain-pool-fetch'
import { mergeDiscoveredPoolsStore, type DiscoveredPoolsStore } from './onchain-discovery-store'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/**
 * D2 (live-caught 2026-10-27): the mock filter matched the NAME regex only.
 * When RPC throttling made name/symbol reads fail during a live scan, the 9
 * Phase-1 battery mock pools persisted with name = pool ADDRESS — the regex
 * missed them and they re-entered the /pools list as address-named rows
 * (31 rows vs 22 real, reproduced live). Addresses cannot fail to read:
 * the mock filter must ALSO match by address, and the discovery store must
 * never persist a blocklisted record.
 *
 * The 9 addresses below are live-verified on Base mainnet (name() reads,
 * 2026-10-27): every one is a 'DO NOT USE - Mock ...' battery fixture.
 */

const MOCK_ADDRESSES = [
  '0x5b02b555c139355bfc049004944fc0ffbe7801a7', // Mock Weighted Pool
  '0x11b13956a477a9df59841f8edae2c3716b029d3d', // Mock Stable Pool
  '0x4f4d2ade9de71742ee12c96781fb04a7fbf39c33', // Mock Stable Surge Pool
  '0xe753a3c9c2b496c0d76df9e2b0c33c0ff28518dc', // Mock Gyro Pool (2-CLP)
  '0x6f36fbb7a8c5f2119ef12f8972f537ace549e628', // Mock Gyro ECLP Pool
  '0x414f02a185f375ecac2077eef87a0e967fa3cb49', // Mock ReClamm Pool
  '0x2a630376a2cc3ba4f2cd9a5a0140f75d47513c38', // Mock LBP
  '0xb7cc5a96cdbf6dbdd16a32840c0050a6e4ffcfdd', // Mock Fixed Price LBP
  '0x49c1f0c1783e4289098377408a7444ccfe50feaf', // Mock Stable Pool (dup name)
]

// Live Rootstock pools (must NEVER be blocked)
const REAL_ADDRESSES = [
  '0x93ef211b7b088fd89df019af387b19b01c9c7bc2', // tsPHILO
  '0xf3240825c7d1953c670bc4c380dd37b9ed09073f', // MAXCHAD
  '0xf8e5ca8397ed7fa5c17ebd73c3b42660abf62c53', // pipsUSDC-rCLP
  '0xf64ae6f64be7c223092c399dfd2e388db5e16080', // pNUT whorl
]

describe('Mock pool address blocklist (D2, live-caught 2026-10-27)', () => {
  it('blocks all 9 live-verified Base mainnet mock fixtures', () => {
    for (const address of MOCK_ADDRESSES) {
      expect(isMockPoolAddress(address), `mock not blocked: ${address}`).toBe(true)
    }
  })

  it('address match is case-insensitive (checksummed forms blocked)', () => {
    expect(isMockPoolAddress('0x5B02B555C139355BfC049004944FC0FfBE7801A7')).toBe(true)
    expect(isMockPoolAddress(MOCK_ADDRESSES[0]!.toUpperCase())).toBe(true)
  })

  it('real Rootstock pools are never blocked', () => {
    for (const address of REAL_ADDRESSES) {
      expect(isMockPoolAddress(address), `real pool blocked: ${address}`).toBe(false)
    }
  })

  it('empty/undefined addresses are not blocked (name filter still governs)', () => {
    expect(isMockPoolAddress(undefined)).toBe(false)
    expect(isMockPoolAddress('')).toBe(false)
  })

  it('isMockPoolRecord catches the throttle bypass: mock address with an ADDRESS name', () => {
    // The live failure: name reads failed → name = pool address → regex
    // missed it. The record must still be flagged by its address.
    const record = {
      address: MOCK_ADDRESSES[0]!,
      factory: '0x' + 'f'.repeat(40),
      blockNumber: 52_500_000,
      name: MOCK_ADDRESSES[0]!, // name-read failed → address fell into name
    }

    expect(isMockPoolRecord(record)).toBe(true)
  })

  it('isMockPoolRecord still catches mock NAMES (address unknown-yet case)', () => {
    const record = {
      address: '0x' + 'a'.repeat(40),
      factory: '0x' + 'f'.repeat(40),
      blockNumber: 1,
      name: 'DO NOT USE - Mock Weighted Pool',
    }

    expect(isMockPoolRecord(record)).toBe(true)
  })

  it('isMockPoolRecord passes real pools', () => {
    const record = {
      address: REAL_ADDRESSES[0]!,
      factory: '0x' + 'f'.repeat(40),
      blockNumber: 1,
      name: "Philosopher's Soil",
      symbol: 'tsPHILO',
    }

    expect(isMockPoolRecord(record)).toBe(false)
  })

  it('getBakedPools never returns a blocklisted address (belt)', () => {
    for (const chain of [GqlChainValues.Base, GqlChainValues.BaseSepolia]) {
      for (const pool of getBakedPools(chain)) {
        expect(
          isMockPoolAddress(pool.address),
          `blocklisted pool in baked registry: ${pool.address}`
        ).toBe(false)
      }
    }
  })

  it('the discovery store never persists a blocklisted record (hygiene)', () => {
    const store: DiscoveredPoolsStore = {
      version: 2,
      chainId: 8453,
      fromBlock: 52_131_550,
      cursor: 52_500_000,
      savedAt: 1,
      pools: {},
    }

    const merged = mergeDiscoveredPoolsStore(store, 52_600_000, [
      {
        address: MOCK_ADDRESSES[0]!,
        factory: '0x' + 'f'.repeat(40),
        blockNumber: 52_550_000,
      },
      {
        address: REAL_ADDRESSES[0]!,
        factory: '0x' + 'f'.repeat(40),
        blockNumber: 52_550_001,
      },
    ] as never)

    expect(Object.keys(merged.pools)).toHaveLength(1)
    expect(merged.pools[REAL_ADDRESSES[0]!]!).toBeDefined()
    expect(merged.pools[MOCK_ADDRESSES[0]!]!).toBeUndefined()
  })
})
