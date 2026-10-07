import { createPublicClient, http, type PublicClient } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { weightedPoolAbi_V3 } from '@balancer/sdk'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  POOL_REGISTERED_TOPIC0,
  getOnchainDiscoveryRpcUrl,
  getOnchainScanConfig,
  type OnchainPoolListItem,
} from './onchain-pool-discovery'
import bakedRegistry from './baked-pool-registry.json'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'

/**
 * Rootstock onchain pool fetch (BASESEP).
 *
 * Architecture (S100):
 * - BAKED registry loads INSTANTLY (frozen at IPFS freeze time via
 *   generate-baked-registry.mjs) — this is the "minimal indexing in IPFS"
 *   Boss directive. Pool list available in <50ms.
 * - LIVE scan runs in background — catches new pools created after the
 *   bake. Same Vault PoolRegistered event scan, just async.
 * - NEVER the remote API (onchain-only law).
 *
 * Live scan truth (verified 2026-09-22):
 * - sepolia.base.org eth_getLogs limited to 500-block range (tightened from 1,000; observed 2026-10-06)
 * - full scan from deploy block ~75s cold-start (hence baked-first)
 */

const CHUNK = 500

// Non-generic factory: pins the exact client instantiation so TS2719
// (two unrelated PublicClient instantiations of the generic) cannot occur.
// S100b: explicit return type — TS7056 (inferred type exceeds serialization
// length) triggered by e2e-tests buildinfo once the registry JSON import grew.
function createDiscoveryClient(): PublicClient {
  // S109: delegate to the per-chain factory using the Base Sepolia scan
  // config (keeps the S100 discoveryClient() API; scan config is the
  // single source of vault + fromBlock truth now).
  // S109: delegate to the per-chain factory with the Base Sepolia scan
  // config (vault + fromBlock truth lives in onchain-pool-discovery.ts).
  return createDiscoveryClientFor({
    chainId: 84532,
    rpcUrl: getOnchainDiscoveryRpcUrl(),
  })
}

type DiscoveryClient = ReturnType<typeof createDiscoveryClient>

let cachedClient: DiscoveryClient | undefined

export function discoveryClient(): DiscoveryClient {
  if (!cachedClient) {
    cachedClient = createDiscoveryClient()
  }

  return cachedClient
}

/**
 * S109: per-chain discovery client (called by the per-chain scan).
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
 * S100b Boss law (2026-09-24): pools page showed E2E mock junk ('DO NOT USE
 * - Mock ...') from Phase-1 battery scripts. Mock-named pools NEVER display.
 * Real named pools (e.g. 'Rootstock WETH/BAL Pool') always pass.
 */
export function isMockPoolName(name: string | undefined | null): boolean {
  if (!name) return false
  return /do\s*not\s*use/i.test(name)
}

/** Baked registry → OnchainPoolListItem[] (instant, no RPC). */
export function getBakedPools(): OnchainPoolListItem[] {
  return (bakedRegistry as { pools: BakedPool[] }).pools
    .filter(p => !isMockPoolName(p.name) && !isMockPoolName(p.symbol))
    .map(p => ({
      id: p.address,
      address: p.address,
      chain: GqlChainValues.BaseSepolia,
      type: p.type as OnchainPoolListItem['type'],
      protocolVersion: 3,
      symbol: p.symbol || '',
      name: p.name || p.symbol || p.address,
      factory: p.factory,
      createTime: p.blockNumber,
      // S100b audit fix F6: registry tokens may carry ERC20 metadata
      // (symbol/name/decimals) — pass it through so pool list pills render
      // token symbols, not icon-only (browser-verified defect).
      poolTokens: (p.tokens || []).map((t: string | BakedPoolToken) =>
        typeof t === 'string'
          ? { address: t }
          : { address: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals }
      ),
      dynamicData: {
        totalLiquidity: '0',
        volume24h: '0',
        fees24h: '0',
        aprItems: [],
      },
    }))
}

/** S100b F6: enriched token entry in the baked registry. */
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
  // S109: per-chain scan — chains without a Rootstock vault (Base mainnet)
  // honestly return zero pools rather than leak upstream routing.
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig) return []

  const client = createDiscoveryClientFor(scanConfig)
  const latest = await client.getBlockNumber()
  const logs: DiscoveredRaw[] = []

  const FROM_BLOCK = BigInt(scanConfig.fromBlock)

  for (let to = latest; to > FROM_BLOCK; to -= BigInt(CHUNK)) {
    const from = to - BigInt(CHUNK) >= FROM_BLOCK ? to - BigInt(CHUNK) : FROM_BLOCK

    const raw = (await client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: scanConfig.vault as `0x${string}`,
          topics: [POOL_REGISTERED_TOPIC0],
          fromBlock: ('0x' + from.toString(16)) as `0x${string}`,
          toBlock: ('0x' + to.toString(16)) as `0x${string}`,
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

  const items = await Promise.all(
    logs.map(async ({ pool, factory, blockNumber }) => {
      const item: OnchainPoolListItem = {
        id: pool,
        address: pool,
        chain,
        type: 'WEIGHTED',
        protocolVersion: 3,
        symbol: '',
        name: pool,
        factory,
        createTime: Number(blockNumber),
        poolTokens: [],
        dynamicData: {
          totalLiquidity: '0',
          volume24h: '0',
          fees24h: '0',
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
        item.poolTokens = (tokens as string[]).map(address => ({ address }))
      } catch {
        // registered but unreadable — keep minimal entry
      }

      return item
    })
  )

  // S100b Boss law (2026-09-24): mock-named pools NEVER display — filter at
  // the live-scan source so pool list AND swap handler only see real pools.
  return items.filter(item => !isMockPoolName(item.name) && !isMockPoolName(item.symbol))
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

    // S100b audit fix F6: live scan tokens are address-only (browser RPC
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

// S113d: per-chain cache — with TWO live Rootstock chains (Base mainnet +
// Base Sepolia) a single promise would poison the wrong chain's results.
const liveScanPromises = new Map<GqlChain, Promise<OnchainPoolListItem[]>>()

/**
 * Primary fetch: baked-first (instant), then live scan merges in background.
 * Returns baked immediately if live scan not yet complete.
 */
export async function fetchDiscoveredPools(
  chain: GqlChain = GqlChainValues.BaseSepolia
): Promise<OnchainPoolListItem[]> {
  // S109: baked registry is the Base Sepolia deployment snapshot — other
  // chains rely on the live scan only.
  const baked = chain === GqlChainValues.BaseSepolia ? getBakedPools() : []

  let promise = liveScanPromises.get(chain)

  if (!promise) {
    promise = scanDiscoveredPools(chain).catch(() => baked) // scan failure → baked still works
    liveScanPromises.set(chain, promise)
  }

  // Race with short timeout: if live scan finishes fast (cached/warm), use merged.
  // Otherwise return baked immediately; live merges on next query (staleTime refetch).
  const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 500))
  const live = await Promise.race([promise, timeoutPromise])

  if (live) return mergePools(baked, live)
  return baked
}
