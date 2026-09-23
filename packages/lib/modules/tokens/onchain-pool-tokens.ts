import { erc20Abi, type Address } from 'viem'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { GqlToken } from '@repo/lib/shared/services/api/graphql-derived-types'
import { discoveryClient, fetchDiscoveredPools } from '../pool/onchain-pool-fetch'

/**
 * Rootstock: tokens of onchain-discovered pools (BASESEP), metadata read
 * directly onchain (erc20 name/symbol/decimals via multicall). Feeds the
 * swap/LP token-select UI — never the remote API (onchain-only law, S100).
 */

const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
const WETH_BASESEP = '0x4200000000000000000000000000000000000006'

export async function fetchOnchainPoolTokens(): Promise<GqlToken[]> {
  const pools = await fetchDiscoveredPools()
  const client = discoveryClient()

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
    chain: GqlChainValues.BaseSepolia,
    chainId: 84532,
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

    if (name.status !== 'success' || symbol.status !== 'success' || decimals.status !== 'success') {
      continue // unreadable token — skip
    }

    tokens.push({
      ...base,
      address: list[i],
      name: name.result as string,
      symbol: symbol.result as string,
      decimals: decimals.result as number,
    })
  }

  return tokens
}
