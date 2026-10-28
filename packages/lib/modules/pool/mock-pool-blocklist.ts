/**
 * Mock pool ADDRESS blocklist (D2, live-caught 2026-10-27).
 *
 * The name regex (`isMockPoolName`) was the only mock filter — but a live
 * scan under RPC throttling fails the name/symbol reads and persists the
 * record with name = pool ADDRESS, which the regex never matches. The 9
 * Phase-1 battery fixtures then re-entered /pools as address-named rows
 * (31 rows vs 22 real, reproduced live on root.basednut.com).
 *
 * Addresses cannot fail to read: every filter layer ALSO matches by
 * address. The 9 entries are live-verified on Base mainnet (name() reads,
 * 2026-10-27) — every one a 'DO NOT USE - Mock ...' battery fixture.
 */

/** Lowercase addresses of Phase-1 battery mock fixtures (live-verified 2026-10-27). */
export const MOCK_POOL_ADDRESSES: readonly string[] = [
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

const MOCK_ADDRESS_SET = new Set(MOCK_POOL_ADDRESSES)

/** True when the address is a known battery mock fixture (case-insensitive). */
export function isMockPoolAddress(address: string | undefined | null): boolean {
  if (!address) return false
  return MOCK_ADDRESS_SET.has(address.toLowerCase())
}

/**
 * Full-record mock check: address blocklist OR the name regex. The record
 * shape is the discovery-store record (address always present; name may
 * have fallen back to the address when its read failed).
 */
export function isMockPoolRecord(record: {
  address: string
  name?: string | null
  symbol?: string | null
}): boolean {
  if (isMockPoolAddress(record.address)) return true
  // name fallback: the regex still governs unknown-address records
  // (inline copy of isMockPoolName — no import cycle into onchain-pool-fetch)
  const name = record?.name
  if (!name) return false
  return /do\s*not\s*use/i.test(name)
}
