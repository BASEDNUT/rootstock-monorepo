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

/** Shared fetcher for onchain pool discovery (BASESEP) — used by the React
 * hook and the OnchainSwapHandler. Vault PoolRegistered events + direct reads. */

const DISCOVERY_FROM_BLOCK = 46_984_000
const CHUNK = 5_000

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

export async function fetchDiscoveredPools(): Promise<OnchainPoolListItem[]> {
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

  const pools = await Promise.all(
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

  return pools.map(mapDiscoveredPoolToListItem)
}
