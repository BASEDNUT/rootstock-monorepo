import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Incremental factory-token scan law: refreshes scan only NEW blocks (the
 * persisted cursor + 1 — never the factory deployment block again) and
 * re-read ERC20 metadata only for addresses the store does not know yet.
 * The wide-range getLogs params are captured per call; the multicall
 * contracts list captures which addresses were re-read.
 */

const h = vi.hoisted(() => ({
  /** captured eth_getLogs params per call */
  logCalls: [] as { from: string; to: string; address: string }[],
  /** captured multicall contract addresses (which tokens were re-read) */
  multicallAddresses: [] as string[],
  /** latest block the mocked client reports */
  blockNumber: 47_400_000n,
  /** per-call block numbers (tip-advance race simulation); empty = always blockNumber */
  blockNumbers: [] as bigint[],
  /** token addresses whose metadata reads FAIL (incomplete-record retry law) */
  failMetadataFor: new Set<string>(),
  /** creation logs to return (set per test) keyed by factory address lower */
  logsByFactory: new Map<string, { blockNumber: string; topics: string[] }[]>(),
}))

vi.mock('viem', async importOriginal => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBlockNumber: vi.fn(async () => {
        if (h.blockNumbers.length > 0) return h.blockNumbers.shift()!
        return h.blockNumber
      }),
      request: vi.fn(
        async ({
          method,
          params,
        }: {
          method: string
          params: { address: string; topics: string[]; fromBlock: string; toBlock: string }[]
        }) => {
          if (method === 'eth_getLogs') {
            const range = params[0]!

            h.logCalls.push({
              from: range.fromBlock,
              to: range.toBlock,
              address: range.address.toLowerCase(),
            })

            return h.logsByFactory.get(range.address.toLowerCase()) ?? []
          }

          return []
        }
      ),
      multicall: vi.fn(async ({ contracts }: { contracts: { address: string }[] }) => {
        for (const c of contracts) {
          if (!h.multicallAddresses.includes(c.address)) h.multicallAddresses.push(c.address)
        }

        // 3 reads per token in order: name, symbol, decimals. Addresses in
        // failMetadataFor get failed reads (incomplete-record retry law).
        return contracts.map((c, i) => {
          if (h.failMetadataFor.has(c.address.toLowerCase())) {
            return { status: 'failure', error: new Error('mock metadata read failed') }
          }

          return { status: 'success', result: i % 3 === 2 ? 18 : `Token ${Math.floor(i / 3)}` }
        })
      }),
    })),
  }
})

import {
  clearAllFactoryTokensStores,
  factoryTokensStoreKey,
  saveFactoryTokensStore,
} from './factory-tokens-store'
import { fetchOnchainFactoryTokens } from './onchain-factory-tokens'
// Deployment identity comes from the canonical config so the spec can never
// drift from the addresses the production scan actually uses.
import {
  FACTORY_SCAN_FROM_BLOCK,
  TOKEN_CREATED_TOPIC0,
  TOKEN_FACTORY,
  WRAPPER_FACTORY,
} from './primitives.config'

const fromHex = (s: string) => parseInt(s, 16)
const toHex = (n: number) => '0x' + n.toString(16)

const FROM_BLOCK = FACTORY_SCAN_FROM_BLOCK

function creationLog(block: number, token: string): { blockNumber: string; topics: string[] } {
  return {
    blockNumber: toHex(block),
    topics: [TOKEN_CREATED_TOPIC0, '0x' + '0'.repeat(24) + token.slice(2).toLowerCase()],
  }
}

beforeEach(() => {
  h.logCalls.length = 0
  h.multicallAddresses.length = 0
  h.blockNumber = 47_400_000n
  h.blockNumbers = []
  h.failMetadataFor.clear()
  h.logsByFactory.clear()
  clearAllFactoryTokensStores()
})

describe('incremental factory-token scans (auditor finding: no rescan-from-deployment-block)', () => {
  it('first fetch scans from the deployment fromBlock and persists the cursor + metadata', async () => {
    const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    h.logsByFactory.set(TOKEN_FACTORY.toLowerCase(), [creationLog(FROM_BLOCK + 100, token)])

    const tokens = await fetchOnchainFactoryTokens(84532)

    // first scan starts at the deployment block
    const minFrom = Math.min(...h.logCalls.map(c => fromHex(c.from)))
    expect(minFrom).toBe(FROM_BLOCK)
    // metadata read ran for the new token
    expect(h.multicallAddresses).toContain(token)
    expect(tokens.map(t => t.address)).toContain(token)

    // the store persisted with the cursor at the scanned head
    const raw = localStorage.getItem(factoryTokensStoreKey(84532))
    expect(raw).toBeTruthy()
    const store = JSON.parse(raw!)
    expect(store.cursor).toBe(Number(h.blockNumber))
    expect(store.tokens[token.toLowerCase()]).toBeTruthy()
  })

  it('second fetch scans from cursor + 1 (never the deployment block again) and re-reads NOTHING', async () => {
    const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    h.logsByFactory.set(TOKEN_FACTORY.toLowerCase(), [creationLog(FROM_BLOCK + 100, token)])

    await fetchOnchainFactoryTokens(84532)
    h.logCalls.length = 0
    h.multicallAddresses.length = 0
    h.logsByFactory.clear() // nothing new

    const tokens = await fetchOnchainFactoryTokens(84532)

    // every scan range starts AFTER the persisted cursor
    for (const call of h.logCalls) {
      expect(fromHex(call.from)).toBeGreaterThan(Number(h.blockNumber))
    }

    // no new creations -> zero metadata reads
    expect(h.multicallAddresses).toEqual([])
    // the persisted token still renders from stored metadata
    expect(tokens.map(t => t.address)).toContain(token)
  })

  it('a NEW creation after the cursor is scanned incrementally and only its metadata is read', async () => {
    const oldToken = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    h.logsByFactory.set(TOKEN_FACTORY.toLowerCase(), [creationLog(FROM_BLOCK + 100, oldToken)])
    await fetchOnchainFactoryTokens(84532)

    h.logCalls.length = 0
    h.multicallAddresses.length = 0

    const newToken = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

    h.logsByFactory.set(TOKEN_FACTORY.toLowerCase(), [
      creationLog(FROM_BLOCK + 100, oldToken),
      creationLog(Number(h.blockNumber) + 50, newToken),
    ])

    h.blockNumber = 47_400_050n

    const tokens = await fetchOnchainFactoryTokens(84532)

    // incremental: every range starts after the OLD cursor
    const oldCursor = 47_400_000

    for (const call of h.logCalls) {
      expect(fromHex(call.from)).toBeGreaterThan(oldCursor)
    }

    // only the NEW address is re-read — the old one renders from the store
    expect(h.multicallAddresses).toEqual([newToken])
    expect(tokens.map(t => t.address).sort()).toEqual([oldToken, newToken].sort())
  })

  it('tip-advance race: the persisted cursor is the block BOTH scans covered (min, never max)', async () => {
    const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    h.logsByFactory.set(TOKEN_FACTORY.toLowerCase(), [creationLog(FROM_BLOCK + 100, token)])

    // the two factory scans call getBlockNumber independently; the chain tip
    // advances between them: token scan sees N, wrapper scan sees N+1. The
    // token scan NEVER covered N+1 - the cursor must be N, never N+1 (a max
    // cursor permanently skips the block one scan never read).
    const N = 47_400_000n
    h.blockNumbers = [N, N + 1n]

    await fetchOnchainFactoryTokens(84532)

    const raw = localStorage.getItem(factoryTokensStoreKey(84532))
    expect(raw).toBeTruthy()
    const store = JSON.parse(raw!)
    expect(store.cursor).toBe(Number(N))
  })

  it('a failed metadata read persists an incomplete record and retries it on the NEXT refresh', async () => {
    const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    h.logsByFactory.set(TOKEN_FACTORY.toLowerCase(), [creationLog(FROM_BLOCK + 100, token)])

    // first fetch: the token's metadata reads FAIL - incomplete record persists
    h.failMetadataFor.add(token)
    let tokens = await fetchOnchainFactoryTokens(84532)
    expect(tokens.map(t => t.address)).not.toContain(token) // incomplete - not rendered

    const raw1 = localStorage.getItem(factoryTokensStoreKey(84532))
    expect(raw1).toBeTruthy()
    const store1 = JSON.parse(raw1!)
    const record1 = store1.tokens[token]
    expect(record1).toBeTruthy() // persisted, incomplete (address + block only)
    expect(record1.name).toBeUndefined()

    // second fetch: metadata reads succeed - the incomplete record is retried
    // (its block is behind the cursor; only the retry loop brings it back)
    h.failMetadataFor.clear()
    h.logCalls.length = 0
    h.multicallAddresses.length = 0
    h.logsByFactory.clear() // nothing new in the scan window

    tokens = await fetchOnchainFactoryTokens(84532)

    // the retried address is re-read
    expect(h.multicallAddresses).toContain(token)
    // and now renders complete
    const rendered = tokens.find(t => t.address.toLowerCase() === token)
    expect(rendered).toBeTruthy()
    expect(rendered!.name).toBeTruthy()
    expect(rendered!.decimals).toBe(18)

    // and the store record is now complete
    const raw2 = localStorage.getItem(factoryTokensStoreKey(84532))
    const store2 = JSON.parse(raw2!)
    expect(store2.tokens[token].name).toBeTruthy()
  })

  it('a store recorded against a different factory deployment is voided (full rescan)', async () => {
    const store = {
      version: 1,
      chainId: 84532,
      tokenFactory: '0x0000000000000000000000000000000000000001',
      wrapperFactory: WRAPPER_FACTORY,
      fromBlock: FROM_BLOCK,
      cursor: 47_390_000,
      savedAt: 1,
      tokens: {},
    }

    saveFactoryTokensStore(store)

    h.logsByFactory.clear()

    await fetchOnchainFactoryTokens(84532)

    // identity mismatch voided the store — scan restarts at the deployment block
    const minFrom = Math.min(...h.logCalls.map(c => fromHex(c.from)))
    expect(minFrom).toBe(FROM_BLOCK)
  })
})
