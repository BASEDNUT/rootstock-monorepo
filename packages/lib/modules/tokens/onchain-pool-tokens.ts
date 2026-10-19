import { erc20Abi, type Address } from 'viem'
import { tokenAssetsLogoUri } from './token-logo-uri'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import type { GqlToken } from '@repo/lib/shared/services/api/graphql-derived-types'
import { getGqlChain } from '@repo/lib/config/app.config'
import { createDiscoveryClientFor, fetchDiscoveredPools } from '../pool/onchain-pool-fetch'
import { getOnchainScanConfig } from '../pool/onchain-pool-discovery'

/**
 * Rootstock: tokens of onchain-discovered pools (BASESEP), metadata read
 * directly onchain (erc20 name/symbol/decimals via multicall). Feeds the
 * swap/LP token-select UI — never the remote API (onchain-only law, ).
 */

const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const WETH_BASESEP = '0x4200000000000000000000000000000000000006'

export async function fetchOnchainPoolTokens(chainId: number): Promise<GqlToken[]> {
  // FIX-7 (F-02): per-chain — fetch THAT chain's pools, read metadata
  // through THAT chain's client, tag tokens with THAT chain (was
  // BASESEP-hardcoded discoveryClient + tags).
  const chain = getGqlChain(chainId as 8453 | 84532) as GqlChain
  const scanConfig = getOnchainScanConfig(chain)
  if (!scanConfig) return []

  const pools = await fetchDiscoveredPools(chain)
  const client = createDiscoveryClientFor(scanConfig)

  // unique token addresses across discovered pools (native + WETH already synthesized)
  const addresses = new Set<string>()

  for (const pool of pools) {
    for (const t of pool.poolTokens) {
      const a = t.address.toLowerCase()
      if (a !== NATIVE && a !== WETH_BASESEP) addresses.add(t.address)
    }
  }

  const list = [...addresses] as Address[]
  if (list.length === 0) return []

  // one multicall: 3 reads per token
  const contracts = list.flatMap(address => [
    { address, abi: erc20Abi, functionName: 'name' as const },
    { address, abi: erc20Abi, functionName: 'symbol' as const },
    { address, abi: erc20Abi, functionName: 'decimals' as const },
  ])

  const results = await client.multicall({ contracts, allowFailure: true })

  const base = {
    __typename: 'GqlToken' as const,
    // FIX-7: per-chain tags (was BASESEP/84532-hardcoded).
    chain,
    chainId,
    logoURI: '',
    priority: 0,
    tradable: true,
    isErc4626: false,
    isBufferAllowed: false,
    coingeckoId: null as string | null,
    priceRateProviderData: null,
  }

  const tokens: GqlToken[] = []

  for (let i = 0; i < list.length; i++) {
    const name = results[i * 3]
    const symbol = results[i * 3 + 1]
    const decimals = results[i * 3 + 2]

    if (
      !name ||
      !symbol ||
      !decimals ||
      name.status !== 'success' ||
      symbol.status !== 'success' ||
      decimals.status !== 'success' ||
      typeof name.result !== 'string' ||
      typeof symbol.result !== 'string' ||
      typeof decimals.result !== 'number'
    ) {
      continue // unreadable token — skip
    }

    tokens.push({
      ...base,
      address: list[i] as string,
      name: name.result,
      symbol: symbol.result,
      decimals: decimals.result,
      // Rootstock logos: BASEDNUT/tokenAssets raw (our repo, winddown-proof)
      logoURI: tokenAssetsLogoUri(chainId, list[i] as string) ?? '',
    })
  }

  return tokens
}
