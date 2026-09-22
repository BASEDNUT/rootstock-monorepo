'use client'

import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http, type PublicClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { weightedPoolAbi_V3 } from '@balancer/sdk'
import {
  BASESEP_VAULT,
  POOL_REGISTERED_TOPIC0,
  getOnchainDiscoveryRpcUrl,
  mapDiscoveredPoolToListItem,
  type DiscoveredPool,
  type OnchainPoolListItem,
} from './onchain-pool-discovery'

/**
 * Rootstock: onchain pool discovery for BASESEP. Reads Vault PoolRegistered
 * events + direct pool reads. NEVER the remote API (onchain-only law).
 * Scans a bounded window (deploy ~46984936, verified live) in 5k chunks.
 */

const DISCOVERY_FROM_BLOCK = 46_984_000
const CHUNK = 5_000

let cachedClient: PublicClient | undefined
function discoveryClient(): PublicClient {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: baseSepolia,
      transport: http(getOnchainDiscoveryRpcUrl()),
    })
  }
  return cachedClient
}

async function fetchPoolRegistered(): Promise<DiscoveredPool[]> {
  const client = discoveryClient()
  const latest = await client.getBlockNumber()
  const logs: { blockNumber: bigint; pool: `0x${string}`; factory: `0x${string}` }[] = []

  for (let to = latest; to > BigInt(DISCOVERY_FROM_BLOCK); to -= BigInt(CHUNK)) {
    const from = to - BigInt(CHUNK) >= BigInt(DISCOVERY_FROM_BLOCK)
      ? to - BigInt(CHUNK)
      : BigInt(DISCOVERY_FROM_BLOCK)
    const raw = await client.request({
      method: 'eth_getLogs',
      params: [{
        address: BASESEP_VAULT,
        topics: [POOL_REGISTERED_TOPIC0],
        fromBlock: '0x' + from.toString(16),
        toBlock: '0x' + to.toString(16),
      }],
    }) as { blockNumber: `0x${string}`; topics: `0x${string}`[] }[]
    for (const l of raw) {
      logs.push({
        blockNumber: BigInt(l.blockNumber),
        pool: ('0x' + l.topics[1].slice(-40)) as `0x${string}`,
        factory: ('0x' + l.topics[2].slice(-40)) as `0x${string}`,
      })
    }
  }

  return Promise.all(
    logs.map(async ({ pool, factory, blockNumber }) => {
      const dp: DiscoveredPool = { address: pool, factory, blockNumber: Number(blockNumber) }
      try {
        const [name, symbol, tokens, totalSupply] = await Promise.all([
          client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'name' }),
          client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'symbol' }),
          client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'getTokens' }),
          client.readContract({ address: pool, abi: weightedPoolAbi_V3, functionName: 'totalSupply' }),
        ])
        dp.name = name
        dp.symbol = symbol
        dp.tokens = tokens as string[]
        dp.totalSupply = totalSupply
      } catch {
        // registered but unreadable — keep minimal entry
      }
      return dp
    })
  )
}

export function useOnchainPoolDiscovery(enabled: boolean) {
  return useQuery<OnchainPoolListItem[]>({
    queryKey: ['onchain-pool-discovery', 'basesep'],
    queryFn: async () => {
      const pools = await fetchPoolRegistered()
      return pools.map(mapDiscoveredPoolToListItem)
    },
    enabled,
    staleTime: 60_000,
  })
}
