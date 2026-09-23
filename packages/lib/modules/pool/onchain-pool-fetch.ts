import { createPublicClient, http, type PublicClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { weightedPoolAbi_V3 } from '@balancer/sdk'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import {
  BASESEP_VAULT,
  POOL_REGISTERED_TOPIC0,
  getOnchainDiscoveryRpcUrl,
  type OnchainPoolListItem,
} from './onchain-pool-discovery'
import bakedRegistry from './baked-pool-registry.json'

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
 * - sepolia.base.org eth_getLogs limited to 1,000-block range
 * - full scan from deploy block ~75s cold-start (hence baked-first)
 */

const DISCOVERY_FROM_BLOCK = 46_984_000
const CHUNK = 1_000

let cachedClient: PublicClient | undefined

export function discoveryClient(): PublicClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: baseSepolia,
      transport: http(getOnchainDiscoveryRpcUrl()),
    })
  }

  return cachedClient
}

/** Baked registry → OnchainPoolListItem[] (instant, no RPC). */
export function getBakedPools(): OnchainPoolListItem[] {
  return (bakedRegistry as { pools: BakedPool[] }).pools.map(p => ({
    id: p.address,
    address: p.address,
    chain: GqlChainValues.BaseSepolia,
    type: p.type as OnchainPoolListItem['type'],
    protocolVersion: 3,
    symbol: p.symbol || '',
    name: p.name || p.symbol || p.address,
    factory: p.factory,
    createTime: p.blockNumber,
    poolTokens: (p.tokens || []).map((address: string) => ({ address })),
    dynamicData: {
      totalLiquidity: '0',
      volume24h: '0',
      fees24h: '0',
      aprItems: [],
    },
  }))
}

interface BakedPool {
  address: string
  factory: string
  blockNumber: number
  type: string
  name?: string
  symbol?: string
  tokens?: string[]
}

interface DiscoveredRaw {
  blockNumber: bigint
  pool: `0x${string}`
  factory: `0x${string}`
}

/** Full live scan — Vault PoolRegistered events + direct pool reads. */
export async function scanDiscoveredPools(): Promise<OnchainPoolListItem[]> {
  const client = discoveryClient()
  const latest = await client.getBlockNumber()
  const logs: DiscoveredRaw[] = []

  for (let to = latest; to > BigInt(DISCOVERY_FROM_BLOCK); to -= BigInt(CHUNK)) {
    const from =
      to - BigInt(CHUNK) >= BigInt(DISCOVERY_FROM_BLOCK)
        ? to - BigInt(CHUNK)
        : BigInt(DISCOVERY_FROM_BLOCK)

    const raw = (await client.request({
      method: 'eth_getLogs',
      params: [
        {
          address: BASESEP_VAULT,
          topics: [POOL_REGISTERED_TOPIC0],
          fromBlock: '0x' + from.toString(16),
          toBlock: '0x' + to.toString(16),
        },
      ],
    })) as { blockNumber: `0x${string}`; topics: `0x${string}`[] }[]

    for (const l of raw) {
      logs.push({
        blockNumber: BigInt(l.blockNumber),
        pool: ('0x' + l.topics[1].slice(-40)) as `0x${string}`,
        factory: ('0x' + l.topics[2].slice(-40)) as `0x${string}`,
      })
    }
  }

  const items = await Promise.all(
    logs.map(async ({ pool, factory, blockNumber }) => {
      const item: OnchainPoolListItem = {
        id: pool,
        address: pool,
        chain: GqlChainValues.BaseSepolia,
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

  return items
}

/** Merge helper: baked + live-discovered (live wins on address conflict). */
export function mergePools(
  baked: OnchainPoolListItem[],
  live: OnchainPoolListItem[]
): OnchainPoolListItem[] {
  const byAddress = new Map<string, OnchainPoolListItem>()
  for (const p of baked) byAddress.set(p.address.toLowerCase(), p)
  for (const p of live) byAddress.set(p.address.toLowerCase(), p) // live overrides baked
  return [...byAddress.values()]
}

let liveScanPromise: Promise<OnchainPoolListItem[]> | undefined

/**
 * Primary fetch: baked-first (instant), then live scan merges in background.
 * Returns baked immediately if live scan not yet complete.
 */
export async function fetchDiscoveredPools(): Promise<OnchainPoolListItem[]> {
  const baked = getBakedPools()

  if (!liveScanPromise) {
    liveScanPromise = scanDiscoveredPools().catch(() => baked) // scan failure → baked still works
  }

  // Race with short timeout: if live scan finishes fast (cached/warm), use merged.
  // Otherwise return baked immediately; live merges on next query (staleTime refetch).
  const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 500))
  const live = await Promise.race([liveScanPromise, timeoutPromise])

  if (live) return mergePools(baked, live)
  return baked
}
