import type { GqlToken } from '@repo/lib/shared/services/api/graphql-derived-types'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { getNetworkConfig } from '@repo/lib/config/app.config'

/**
 * Rootstock: onchain-only networks (e.g. our Base Sepolia deployment) are not
 * served by the remote API. Their token metadata is synthesized locally from
 * NetworkConfig so token selection and swap defaults work onchain-first,
 * with no upstream API dependency. Addresses are deployment-verified.
 */
export function getOnchainOnlyTokens(): GqlToken[] {
  const onchainOnly = PROJECT_CONFIG.onchainOnlyNetworks || []
  const tokens: GqlToken[] = []

  for (const chain of onchainOnly) {
    const networkConfig = getNetworkConfig(chain)
    const { nativeAsset, addresses } = networkConfig.tokens

    const base = {
      __typename: 'GqlToken' as const,
      chain,
      chainId: networkConfig.chainId,
      logoURI: '',
      priority: 0,
      tradable: true,
      isErc4626: false,
      isBufferAllowed: true,
      coingeckoId: 'weth',
      priceRateProviderData: null,
    }

    tokens.push({
      ...base,
      address: nativeAsset.address,
      name: nativeAsset.name,
      symbol: nativeAsset.symbol,
      decimals: nativeAsset.decimals,
    })

    tokens.push({
      ...base,
      address: addresses.wNativeAsset,
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: nativeAsset.decimals,
    })
  }

  return tokens
}
