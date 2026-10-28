import { createPublicClient, erc20Abi, http, type PublicClient } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { vaultExtensionAbi_V3, weightedPoolAbi_V3 } from '@balancer/sdk'
import { getRootstockHookReviewData } from '../hooks/rootstockHooks'
import { isMockPoolAddress, isMockPoolRecord, MOCK_POOL_ADDRESSES } from './mock-pool-blocklist'

export { isMockPoolAddress, isMockPoolRecord, MOCK_POOL_ADDRESSES }
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  FACTORY_TO_POOL_TYPE,
  POOL_REGISTERED_TOPIC0,
  derivePoolDisplayFacts,
  getOnchainDiscoveryRpcUrl,
  getOnchainScanConfig,
  mapDiscoveredPoolToListItem,
  type DiscoveredPoolToken,
  type OnchainPoolListItem,
} from './onchain-pool-discovery'
import {
  DISCOVERED_POOLS_STORE_VERSION,
  clearAllDiscoveredPoolsStores,
  isEnrichedRecord,
  loadDiscoveredPoolsStore,
  mergeDiscoveredPoolsStore,
  saveDiscoveredPoolsStore,
  type DiscoveredPoolRecord,
} from './onchain-discovery-store'
import bakedRegistrySepolia from './baked-pool-registry.json'
import bakedRegistryBase from './baked-pool-registry-base.json'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'

/**
 * Rootstock onchain pool fetch (BASESEP).
 *
 * Architecture:
 * - BAKED registry loads INSTANTLY (frozen at IPFS freeze time via
 *   generate-baked-registry.mjs) — this is the minimal-indexing-in-IPFS
 *   design. Pool list available in <50ms.
 * - LIVE scan runs in background — catches new pools created after the
 *   bake. Same Vault PoolRegistered event scan, just async.
 * - NEVER the remote API (onchain-only law).
 *
 * Live scan truth (verified against the live chain):
 * - sepolia.base.org eth_getLogs limited to 500-block range (tightened
 *   from 1,000)
 * - full scan from deploy block ~75s cold-start (hence baked-first)
 */

const CHUNK = 500

/**
 * Reorg-safety margin: the persisted cursor only advances to the
 * finalized head (latest minus this margin). Base reorgs are shallow
 * and rare, but a cursor written past a later reorg point would skip
 * reorged-in registrations forever. The scan itself still covers the
 * full tip - new pools appear immediately; only the CURSOR lags by the
 * safety margin.
 */
export const REORG_SAFETY_BLOCKS = 64

// Non-generic factory: pins the exact client instantiation so TS2719
// (two unrelated PublicClient instantiations of the generic) cannot occur.
// explicit return type — TS7056 (inferred type exceeds serialization
// length) triggered by e2e-tests buildinfo once the registry JSON import grew.
function createDiscoveryClient(): PublicClient {
  // delegate to the per-chain factory using the Base Sepolia scan
  // config (keeps the discoveryClient() API; scan config is the
  // single source of vault + fromBlock truth now).
  // delegate to the per-chain factory with the Base Sepolia scan
  // config (vault + fromBlock truth lives in onchain-pool-discovery.ts).
  return createDiscoveryClientFor({
    chainId: 84532,
    rpcUrl: getOnchainDiscoveryRpcUrl(),
  })
}

export type DiscoveryClient = ReturnType<typeof createDiscoveryClient>

let cachedClient: DiscoveryClient | undefined

export function discoveryClient(): DiscoveryClient {
  if (!cachedClient) {
    cachedClient = createDiscoveryClient()
  }

  return cachedClient
}

/**
 * per-chain discovery client (called by the per-chain scan).
 * Base Sepolia (84532) → sepolia.base.org; Base mainnet (8453) →
 * base.publicnode.com via the scan config rpcUrl.
 */
export function createDiscoveryClientFor(scanConfig: {
  chainId: number
  rpcUrl: string
}): DiscoveryClient {
  const viemChain = scanConfig.chainId === 84532 ? baseSepolia : base
  return createPublicClient({
    chain: viemChain,
    transport: http(scanConfig.rpcUrl),
  }) as PublicClient
}

/**
 * Mock-named pools ('DO NOT USE
 * - Mock...') from Phase-1 battery scripts. Mock-named pools NEVER display.
 * Real named pools (e.g. 'Rootstock WETH/BAL Pool') always pass.
 */
export function isMockPoolName(name: string | undefined | null): boolean {
  if (!name) return false
  return /do\s*not\s*use/i.test(name)
}

/** Baked registry → OnchainPoolListItem[] (instant, no RPC). */
export function getBakedPools(chain: GqlChain): OnchainPoolListItem[] {
  // Per-chain baked registries — the Base Sepolia snapshot
  // stays baked-pool-registry.json; Base mainnet has
  // baked-pool-registry-base.json. Chain tag comes from the parameter
  // (was a hardcoded GqlChainValues.BaseSepolia).
  const registryFile = chain === GqlChainValues.Base ? bakedRegistryBase : bakedRegistrySepolia

  const registry = registryFile as { chainId: number; pools: BakedPool[] }
  return registry.pools
    .filter(
      p => !isMockPoolName(p.name) && !isMockPoolName(p.symbol) && !isMockPoolAddress(p.address)
    )
    .map(p => ({
      id: p.address,
      address: p.address,
      chain,
      type: p.type as OnchainPoolListItem['type'],
      protocolVersion: 3,
      symbol: p.symbol || '',
      name: p.name || p.symbol || p.address,
      factory: p.factory,
      createTime: p.blockNumber,
      // audit fix F6: registry tokens may carry ERC20 metadata
      // (symbol/name/decimals) — pass it through so pool list pills render
      // token symbols, not icon-only (browser-verified defect).
      poolTokens: (p.tokens || []).map((t: string | BakedPoolToken) =>
        typeof t === 'string'
          ? { address: t }
          : { address: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals }
      ),
      hook: p.hook
        ? {
            address: p.hook,
            reviewData: getRootstockHookReviewData(p.hook) ?? undefined,
          }
        : null,
      tags: p.tags ?? [],
      dynamicData: {
        totalLiquidity: null,
        volume24h: null,
        fees24h: null,
        aprItems: [],
      },
    }))
}

/** The chain-matching baked registry raw file (PoolLayout consumer). */
export function getBakedRegistryFile(chain: GqlChain): { chainId: number; pools: BakedPool[] } {
  const registryFile = chain === GqlChainValues.Base ? bakedRegistryBase : bakedRegistrySepolia

  return registryFile as { chainId: number; pools: BakedPool[] }
}

/**  F6: enriched token entry in the baked registry. */
export interface BakedPoolToken {
  address: string
  symbol?: string
  name?: string
  decimals?: number
}

interface BakedPool {
  address: string
  factory: string
  blockNumber: number
  type: string
  name?: string
  symbol?: string
  tokens?: (string | BakedPoolToken)[]
  /** v2 display facts baked by generate-baked-registry.mjs. */
  hook?: string | null
  tags?: string[]
}

interface DiscoveredRaw {
  blockNumber: bigint
  pool: `0x${string}`
  factory: `0x${string}`
}

/** Full live scan — Vault PoolRegistered events + direct pool reads. */
export async function scanDiscoveredPools(
  chain: GqlChain = GqlChainValues.BaseSepolia
): Promise<OnchainPoolListItem[]> {
  // Per-chain scan — chains without a Rootstock vault honestly return zero
  // pools rather than leak upstream routing.
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig) return []

  const client = createDiscoveryClientFor(scanConfig)
  const latest = await client.getBlockNumber()
  const logs: DiscoveredRaw[] = []

  // Incremental cursor: resume from the last
  // scanned block + 1 (exclusive boundary) — never rescan from
  // scanConfig.fromBlock, never overlap chunk boundaries.
  const startBlock = nextScanStartBlock(lastScannedBlock.get(chain), scanConfig.fromBlock)

  for (const range of chunkedLogRanges(startBlock, Number(latest), CHUNK)) {
    const raw = (await client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: scanConfig.vault as `0x${string}`,
          topics: [POOL_REGISTERED_TOPIC0],
          fromBlock: ('0x' + BigInt(range.from).toString(16)) as `0x${string}`,
          toBlock: ('0x' + BigInt(range.to).toString(16)) as `0x${string}`,
        },
      ],
    })) as { blockNumber: `0x${string}`; topics: `0x${string}`[] }[]

    for (const l of raw) {
      const poolTopic = l.topics[1]
      const factoryTopic = l.topics[2]
      if (!poolTopic || !factoryTopic) continue // malformed log — skip

      logs.push({
        blockNumber: BigInt(l.blockNumber),
        pool: ('0x' + poolTopic.slice(-40)) as `0x${string}`,
        factory: ('0x' + factoryTopic.slice(-40)) as `0x${string}`,
      })
    }
  }

  // Reorg-safe cursor: advance only to the FINALIZED head (latest minus
  // the safety margin) - even when nothing new was found. The next scan
  // re-covers the overlap window, so a reorged-in registration is never
  // skipped; an unchanged chain rescans only the safety-overlap window
  // (one 500-block chunk), never full history.
  const finalizedHead = Number(latest) - REORG_SAFETY_BLOCKS
  lastScannedBlock.set(chain, finalizedHead)
  lastScanTimestamp.set(chain, Date.now())

  const items = await Promise.all(
    logs.map(async ({ pool, factory, blockNumber }) => {
      const item: OnchainPoolListItem = {
        id: pool,
        address: pool,
        chain,
        // Classify by the emitting factory (the map covers both chains'
        // factories); an unmapped factory is UNKNOWN - never a guess.
        type: (FACTORY_TO_POOL_TYPE.get(factory.toLowerCase()) ??
          'UNKNOWN') as OnchainPoolListItem['type'],
        protocolVersion: 3,
        symbol: '',
        name: pool,
        factory,
        createTime: Number(blockNumber),
        poolTokens: [],
        dynamicData: {
          totalLiquidity: null,
          volume24h: null,
          fees24h: null,
          aprItems: [],
        },
      }

      try {
        const [name, symbol, tokens] = await Promise.all([
          client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'name' }),
          client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'symbol' }),
          client.readContract({
            address: pool,
            abi: weightedPoolAbi_V3,
            functionName: 'getTokens',
          }),
        ])

        item.name = name
        item.symbol = symbol
        item.poolTokens = await enrichTokensMetadata(client, tokens as string[])
      } catch {
        // registered but unreadable — keep minimal entry
      }

      // v2 display facts: external hook + BOOSTED/PERMISSIONED tags from
      // Vault-level config. Read failures leave facts unset (record heals on
      // a later scan) — never guessed.
      try {
        const [hooksConfig, poolTokenInfo] = await Promise.all([
          client.readContract({
            address: scanConfig.vault as `0x${string}`,
            abi: vaultExtensionAbi_V3,
            functionName: 'getHooksConfig',
            args: [pool],
          }),
          client.readContract({
            address: scanConfig.vault as `0x${string}`,
            abi: vaultExtensionAbi_V3,
            functionName: 'getPoolTokenInfo',
            args: [pool],
          }),
        ])

        const tokenTypes = poolTokenInfo[1].map(t => Number(t.tokenType))

        const facts = derivePoolDisplayFacts({
          pool,
          hooksContract: hooksConfig.hooksContract as string,
          tokenTypes,
        })

        item.hook = facts.hook
          ? {
              address: facts.hook,
              reviewData: getRootstockHookReviewData(facts.hook) ?? undefined,
            }
          : null

        item.tags = facts.tags
      } catch {
        // facts stay unset — re-derived on the next scan (record incomplete)
      }

      return item
    })
  )

  // Mock-named pools NEVER display — filter at
  // the live-scan source so pool list AND swap handler only see real pools.
  const realItems = items.filter(
    item =>
      !isMockPoolName(item.name) && !isMockPoolName(item.symbol) && !isMockPoolAddress(item.address)
  )

  // Cumulative-discovery persistence: an incremental
  // cursor alone loses pools — a pool discovered in a previous session
  // vanishes after cache expiry when it is absent from the baked registry.
  // Persist every real discovery so a later cold load renders instantly
  // and the next scan resumes at the cursor. Persistence failure never
  // breaks discovery — the in-memory list still returns.
  try {
    const existing = loadDiscoveredPoolsStore(scanConfig.chainId, scanConfig.fromBlock) ?? {
      version: DISCOVERED_POOLS_STORE_VERSION,
      chainId: scanConfig.chainId,
      fromBlock: scanConfig.fromBlock,
      cursor: scanConfig.fromBlock - 1,
      savedAt: 0,
      pools: {},
    }

    // A fresh item whose enrichment reads failed is
    // INCOMPLETE — persisted without the enriched flag so a later scan
    // heals it (tokens non-empty = enrichment succeeded).
    const records: DiscoveredPoolRecord[] = realItems.map(item => ({
      address: item.address,
      factory: item.factory,
      blockNumber: item.createTime,
      name: item.name,
      symbol: item.symbol,
      tokens: item.poolTokens,
      ...(item.poolTokens.length > 0 ? { enriched: true } : {}),
      ...(item.hook !== undefined ? { hook: item.hook ? item.hook.address : null } : {}),
      ...(item.tags !== undefined ? { tags: item.tags } : {}),
    }))

    // Heal records whose enrichment failed on an
    // EARLIER scan — re-read their metadata now (same client, same reads)
    // instead of freezing them blank forever. A still-failing read stays
    // incomplete and is retried on the next scan; never throws.
    // v2: a record missing display facts (hook/tags) is also incomplete —
    // pre-v2 records self-heal here on the first post-bump scan.
    const persistedIncomplete = Object.values(existing.pools).filter(
      r => !isEnrichedRecord(r) || r.hook === undefined
    )

    const healed = await reEnrichIncompleteRecords(client, scanConfig, persistedIncomplete)

    saveDiscoveredPoolsStore(
      mergeDiscoveredPoolsStore(existing, finalizedHead, [...records, ...healed])
    )
  } catch {
    // ignore — the in-memory result still returns
  }

  return realItems
}

/**
 * Pills law (2026-10-24): read ERC20 metadata (symbol/name/decimals) for a
 * discovered pool tokens so PoolListTokenPills render ticker text — not
 * icon-only badges (browser-verified defect on live-only pools created
 * after the last registry bake). A token whose reads fail falls back to
 * address-only; never throws.
 */
export async function enrichTokensMetadata(
  client: Pick<PublicClient, 'readContract'>,
  tokens: string[]
): Promise<DiscoveredPoolToken[]> {
  if (tokens.length === 0) return []

  return Promise.all(
    tokens.map(async address => {
      try {
        const [symbol, name, decimals] = await Promise.all([
          client.readContract({
            address: address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'name',
          }),
          client.readContract({
            address: address as `0x${string}`,
            abi: erc20Abi,
            functionName: 'decimals',
          }),
        ])

        return {
          address,
          symbol: symbol as string,
          name: name as string,
          decimals: Number(decimals),
        }
      } catch {
        return { address }
      }
    })
  )
}

/**
 * F-02 (2026-10-13): re-read name/symbol/getTokens for INCOMPLETE records
 * — pools whose enrichment reads failed on an earlier scan (transient RPC
 * failure at discovery time). Only incomplete records are read (complete
 * records never re-read); a still-failing read leaves the record incomplete
 * for the next scan. Never throws.
 */
export async function reEnrichIncompleteRecords(
  client: Pick<PublicClient, 'readContract'>,
  scanConfig: { vault: string },
  records: DiscoveredPoolRecord[]
): Promise<DiscoveredPoolRecord[]> {
  const needsWork = records.filter(r => !isEnrichedRecord(r) || r.hook === undefined)
  if (needsWork.length === 0) return records

  return Promise.all(
    records.map(async record => {
      if (isEnrichedRecord(record) && record.hook !== undefined) return record

      // Re-read base metadata ONLY when missing (enrichment law) — a
      // complete record that only lacks display facts keeps its stored
      // name/symbol/tokens untouched.
      let base = record

      if (!isEnrichedRecord(record)) {
        try {
          const [name, symbol, tokens] = await Promise.all([
            client.readContract({
              address: record.address as `0x${string}`,
              abi: weightedPoolAbi_V3,
              functionName: 'name',
            }),
            client.readContract({
              address: record.address as `0x${string}`,
              abi: weightedPoolAbi_V3,
              functionName: 'symbol',
            }),
            client.readContract({
              address: record.address as `0x${string}`,
              abi: weightedPoolAbi_V3,
              functionName: 'getTokens',
            }),
          ])

          base = {
            ...record,
            name: name as string,
            symbol: symbol as string,
            tokens: await enrichTokensMetadata(client, tokens as string[]),
            enriched: true,
          }
        } catch {
          // still unreadable — stays incomplete, retried next scan
          return record
        }
      }

      // v2 display facts re-read
      try {
        const [hooksConfig, poolTokenInfo] = await Promise.all([
          client.readContract({
            address: scanConfig.vault as `0x${string}`,
            abi: vaultExtensionAbi_V3,
            functionName: 'getHooksConfig',
            args: [record.address as `0x${string}`],
          }),
          client.readContract({
            address: scanConfig.vault as `0x${string}`,
            abi: vaultExtensionAbi_V3,
            functionName: 'getPoolTokenInfo',
            args: [record.address as `0x${string}`],
          }),
        ])

        const tokenTypes = poolTokenInfo[1].map(t => Number(t.tokenType))

        const facts = derivePoolDisplayFacts({
          pool: record.address,
          hooksContract: hooksConfig.hooksContract as string,
          tokenTypes,
        })

        return { ...base, hook: facts.hook, tags: facts.tags }
      } catch {
        // facts still unreadable — stays incomplete for the next scan
        return base
      }
    })
  )
}

/** Merge helper: baked + live-discovered (live wins on address conflict). */
export function mergePools(
  baked: OnchainPoolListItem[],
  live: OnchainPoolListItem[]
): OnchainPoolListItem[] {
  const byAddress = new Map<string, OnchainPoolListItem>()
  for (const p of baked) byAddress.set(p.address.toLowerCase(), p)

  for (const p of live) {
    const key = p.address.toLowerCase()
    const prev = byAddress.get(key)

    // audit fix F6: live scan tokens are address-only (browser RPC
    // budget). When live overrides baked, inherit baked token metadata
    // (symbol/name/decimals) so pills never lose their symbol text.
    if (prev) {
      const mergedTokens = p.poolTokens.map(t => {
        const bakedToken = prev.poolTokens.find(
          bt => bt.address.toLowerCase() === t.address.toLowerCase()
        )

        return bakedToken && (t as { symbol?: string }).symbol ? t : bakedToken || t
      })

      byAddress.set(key, { ...p, poolTokens: mergedTokens })
    } else {
      byAddress.set(key, p) // live-only pool — new pool created after bake
    }
  }

  return [...byAddress.values()]
}

// Per-chain cache — with TWO live Rootstock chains (Base mainnet +
// Base Sepolia) a single promise would poison the wrong chain's results.
const liveScanPromises = new Map<GqlChain, Promise<OnchainPoolListItem[]>>()

/**
 * Discovery freshness state ():
 * - lastScanTimestamp per chain — TTL gate for the cached scan promise.
 * - lastScannedBlock per chain — incremental cursor; the next scan resumes
 *   at cursor + 1 (exclusive boundary, no overlap, no restart from
 *   scanConfig.fromBlock).
 */
const lastScanTimestamp = new Map<GqlChain, number>()
const lastScannedBlock = new Map<GqlChain, number>()

/** Per-chain live-scan TTL (5 min) — expired cache clears and rescans. */
export const ONCHAIN_DISCOVERY_TTL_MS = 5 * 60_000

/** True when the cached scan has never run or is older than the TTL. */
export function isDiscoveryCacheExpired(
  lastScan: number | undefined,
  now: number = Date.now()
): boolean {
  if (lastScan === undefined) return true
  return now - lastScan >= ONCHAIN_DISCOVERY_TTL_MS
}

/**
 * First block of the next scan. Cold start: fromBlock. Incremental: the
 * finalized-head cursor + 1, minus the reorg overlap (the last
 * safety-margin blocks are re-scanned), clamped at fromBlock.
 */
export function nextScanStartBlock(cursor: number | undefined, fromBlock: number): number {
  if (cursor === undefined) return fromBlock
  return Math.max(fromBlock, cursor + 1 - REORG_SAFETY_BLOCKS)
}

/**
 * Chunk a scan window [startBlock, latest] into <=chunk-size eth_getLogs
 * ranges, NEWEST-FIRST, with exclusive boundaries (each chunk starts at
 * the previous chunk's to + 1 — never overlapping). Returns [] when latest
 * is behind startBlock (nothing new to scan).
 */
export function chunkedLogRanges(
  startBlock: number,
  latest: number,
  chunk: number
): { from: number; to: number }[] {
  if (latest < startBlock) return []

  const ranges: { from: number; to: number }[] = []

  for (let to = latest; to >= startBlock; to -= chunk) {
    const from = Math.max(startBlock, to - chunk + 1)
    ranges.push({ from, to })
    if (from === startBlock) break
  }

  return ranges
}

/**
 * Clear the cached live-scan promise for a chain so the next fetch
 * rescans (called after successful pool creation). The incremental cursor
 * and scan timestamp are KEPT — a newly created pool sits in blocks AFTER
 * the cursor, so the rescan picks it up without rescanning history.
 */
export function invalidateDiscovery(chain: GqlChain): void {
  liveScanPromises.delete(chain)
}

/** Test isolation: reset all module-level discovery state. */
export function resetDiscoveryCachesForTests(): void {
  liveScanPromises.clear()
  lastScanTimestamp.clear()
  lastScannedBlock.clear()
  // Persisted discovery stores leak across tests otherwise: a prior spec's
  // scan-save would seed this spec's cursor (chunkedLogRanges then yields
  // no ranges against a smaller mocked latest block) — 0 log calls, false pass/fail.
  clearAllDiscoveredPoolsStores()
}

/**
 * : race decision — await the live scan when it is
 * unresolved AND the baked registry is empty; otherwise keep the fast path
 * (baked immediately, live merges on the next query refetch).
 */
export function shouldAwaitLiveScan(
  live: OnchainPoolListItem[] | null,
  baked: OnchainPoolListItem[]
): boolean {
  if (live) return false // live won the race — merge immediately
  return baked.length === 0 // nothing to show — the await is the honest path
}

/** Scans currently executing — guards the cache against dropping an in-flight scan. */
const inFlightScans = new Set<GqlChain>()

/**
 * A cached scan promise is dropped only when it has settled AND the scan
 * cache is stale. An in-flight scan must never be discarded: a concurrent
 * caller would start a duplicate full-history scan.
 */
export function shouldDropCachedScan(
  hasCachedPromise: boolean,
  scanInFlight: boolean,
  cacheExpired: boolean
): boolean {
  return hasCachedPromise && !scanInFlight && cacheExpired
}

/**
 * Primary fetch: baked-first (instant), then live scan merges in background.
 * Returns baked immediately if live scan not yet complete.
 */
export async function fetchDiscoveredPools(
  chain: GqlChain = GqlChainValues.BaseSepolia
): Promise<OnchainPoolListItem[]> {
  // Integration suite gate: the live scan (~1,700 eth_getLogs POSTs to a
  // public RPC per provider-mounted spec) rate-limits CI runner IPs (429
  // storm) and kills the vitest worker pool mid-socket-write (libuv
  // assertion, ERR_IPC_CHANNEL_CLOSED). vitest.integration.base.ts sets
  // this env for the integration suite only — the dedicated live specs in
  // the unit suite keep the real scans.
  if (process.env.ROOTSTOCK_SKIP_ONCHAIN_SCANS === '1') return []
  // Per-chain baked registries — Sepolia snapshot + the Base
  // mainnet registry.
  const baked = getBakedPools(chain)

  // Cumulative discovery: pools discovered in a previous
  // session must survive cache expiry and reloads while they remain
  // registered on-chain. Persisted records are a live-scan product — they
  // merge into the list with live-wins conflict semantics and seed the
  // incremental cursor so the next scan resumes at cursor + 1.
  const scanConfig = getOnchainScanConfig(chain)
  let persisted: OnchainPoolListItem[] = []

  if (scanConfig) {
    const store = loadDiscoveredPoolsStore(scanConfig.chainId, scanConfig.fromBlock)

    if (store) {
      persisted = Object.values(store.pools)
        .filter(r => !isMockPoolName(r.name) && !isMockPoolName(r.symbol) && !isMockPoolRecord(r))
        .map(r => mapDiscoveredPoolToListItem(r, chain))

      if (!lastScannedBlock.has(chain)) lastScannedBlock.set(chain, store.cursor)
      if (!lastScanTimestamp.has(chain)) lastScanTimestamp.set(chain, store.savedAt)
    }
  }

  const baseList = persisted.length > 0 ? mergePools(baked, persisted) : baked

  // TTL gate: an expired SETTLED scan is cleared and rescanned; a fresh
  // scan (within 5 min) is reused as-is. An in-flight scan is never discarded
  // — a concurrent caller reuses it instead of starting a duplicate
  // full-history scan (the timestamp only advances after the scan completes).
  if (
    shouldDropCachedScan(
      liveScanPromises.has(chain),
      inFlightScans.has(chain),
      isDiscoveryCacheExpired(lastScanTimestamp.get(chain))
    )
  ) {
    liveScanPromises.delete(chain)
  }

  let promise = liveScanPromises.get(chain)

  if (!promise) {
    inFlightScans.add(chain)

    promise = scanDiscoveredPools(chain)
      .catch(() => baseList) // scan failure → list still works
      .finally(() => {
        inFlightScans.delete(chain)
      })

    liveScanPromises.set(chain, promise)
  }

  // Race with short timeout: if live scan finishes fast (cached/warm), use merged.
  // Otherwise return the list immediately; live merges on next query (staleTime refetch).
  const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 500))
  const live = await Promise.race([promise, timeoutPromise])

  if (live) return mergePools(baseList, live)

  // : live lost the race AND the list is empty (Base mainnet
  // cold start with no baked pools and no persisted discoveries) → await the
  // live promise to completion (cached in liveScanPromises; one-time cold
  // cost; the UI shows an honest loading state via useQuery isLoading)
  // instead of returning an empty list until the next refetch.
  if (shouldAwaitLiveScan(live, baseList)) {
    const resolved = await promise
    return mergePools(baseList, resolved)
  }

  return baseList
}
