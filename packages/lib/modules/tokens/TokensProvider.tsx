'use client'

import type { GqlToken, GqlTokenPrice } from '@repo/lib/shared/services/api/graphql-derived-types'
import {
  GetTokenPricesDocument,
  GetTokensDocument,
} from '@repo/lib/shared/services/api/generated/graphql'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { isSameAddress } from '@repo/lib/shared/utils/addresses'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { bn, Numberish, isBnParseable } from '@repo/lib/shared/utils/numbers'
import { useQuery } from '@apollo/client/react'
import { useQueries as useReactQueries } from '@tanstack/react-query'
import { getGqlChain, getChainIds } from '@repo/lib/config/app.config'
import { createContext, PropsWithChildren, useCallback, useMemo } from 'react'
import { Address } from 'viem'
import {
  getNativeAssetAddress,
  getWrappedNativeAssetAddress,
  isDev,
  shouldUseAnvilFork,
} from '@repo/lib/config/app.config'
import { mins } from '@repo/lib/shared/utils/time'
import mainnetNetworkConfig from '@repo/lib/config/networks/mainnet'
import { PoolToken } from '../pool/pool.types'
import { ApiToken, ApiOrCustomToken } from './token.types'
import { getOnchainOnlyTokens } from './onchain-tokens'
import { fetchOnchainPoolTokens } from './onchain-pool-tokens'
// (PRD-07 pickers law): factory-deployed tokens + wrappers discovered
// from TokenCreated / WrapperCreated events — appear in every picker.
import { fetchOnchainFactoryTokens } from '../primitives/onchain-factory-tokens'
// B2a (live-caught 2026-10-21): GT multi-price layer — the price API excludes
// onchain-only networks, so priceFor() starved every Rootstock token
// (detail TVL $0.00, composition prices '—', LP price $0.00).
import { fetchGtTokenPrices, mergeOnchainTokenPrices, GT_NETWORK_IDS } from './onchain-token-prices'
import { PROJECT_CONFIG, toApiNetworks } from '@repo/lib/config/getProjectConfig'

export type UseTokensResult = ReturnType<typeof useTokensLogic>
export const TokensContext = createContext<UseTokensResult | null>(null)

export type GetTokenFn = (address: string, chain: GqlChain) => ApiToken | undefined

const POLL_INTERVAL = mins(3).toMs()

const SUPPORTED_CHAINS = {
  chains: toApiNetworks(PROJECT_CONFIG.supportedNetworks),
}

export function useTokensLogic() {
  const { data: tokensData, loading: isLoadingTokens } = useQuery(GetTokensDocument, {
    variables: SUPPORTED_CHAINS,
  })

  // FIX-7: per-chain onchain token discovery — BASE + BASESEP both
  // run their own queries (per-chain queryKey + per-chain fetch), merged
  // into the token list. (Was: single BASESEP-hardcoded query pair.)
  const onchainOnlyNetworks = PROJECT_CONFIG.onchainOnlyNetworks || []
  const onchainTokenChains = getChainIds(onchainOnlyNetworks)

  const onchainPoolTokensQueries = useReactQueries({
    queries: onchainTokenChains.map(chainId => ({
      queryKey: ['onchain-pool-tokens', getGqlChain(chainId)],
      queryFn: () => fetchOnchainPoolTokens(chainId),
      enabled: onchainTokenChains.length > 0,
      staleTime: 60_000,
    })),
  })

  const factoryTokensQueries = useReactQueries({
    queries: onchainTokenChains.map(chainId => ({
      queryKey: ['onchain-factory-tokens', getGqlChain(chainId)],
      queryFn: () => fetchOnchainFactoryTokens(chainId),
      enabled: onchainTokenChains.length > 0,
      staleTime: 60_000,
    })),
  })

  // FIX-7: useQueries returns a RESULT ARRAY (not {data}) — map each
  // result's data, drop undefined (pending) entries.
  const onchainPoolTokens = onchainPoolTokensQueries
    .map(r => r.data)
    .filter((d): d is GqlToken[] => Array.isArray(d))
    .flat()

  const factoryTokens = factoryTokensQueries
    .map(r => r.data)
    .filter((d): d is GqlToken[] => Array.isArray(d))
    .flat()

  const tokens = useMemo(
    () => [
      ...(tokensData?.tokens || []),
      ...getOnchainOnlyTokens(),
      ...(onchainPoolTokens || []),
      ...(factoryTokens || []),
    ],
    [tokensData, onchainPoolTokens, factoryTokens]
  )

  const {
    data: tokenPricesData,
    loading: isLoadingTokenPrices,
    startPolling,
    stopPolling,
  } = useQuery(GetTokenPricesDocument, {
    variables: SUPPORTED_CHAINS,
    /*
      FIXME: if we use initialFetchPolicy: no-cache in development, the query never finishes (isLoadingTokenPrices is always true)

      This started happening after @apollo/client v3.13.6
      https://github.com/apollographql/apollo-client/blob/main/CHANGELOG.md#3136

      Using undefined is a workaround to avoid the issue in development, but it should be understood and fixed properly
    */
    initialFetchPolicy: isDev ? undefined : 'no-cache',
    nextFetchPolicy: 'cache-and-network',
    pollInterval: POLL_INTERVAL,
  })

  const prices = tokenPricesData?.tokenPrices || []

  // B2a: GT price layer for onchain-only chains (BASE). Addresses come from
  // every onchain token source; empty in unit tests (onchain fetches are
  // mocked []) so no live network fires from the suite.
  // hook-driven sources ONLY (all mocked [] in unit specs — never a live
  // fetch from the suite). getOnchainOnlyTokens() is deliberately NOT
  // called here: it is a direct (non-hook) call returning real addresses
  // in every environment, which would enable the GT query in unit tests
  // and fire live network (the no-live-network law).
  const gtPriceAddresses = useMemo(() => {
    const gtChains = new Set(Object.keys(GT_NETWORK_IDS) as GqlChain[])
    return [
      ...new Set(
        [...(tokensData?.tokens || []), ...(onchainPoolTokens || []), ...(factoryTokens || [])]
          .filter(t => t && gtChains.has(t.chain as GqlChain))
          .map(t => t.address.toLowerCase())
      ),
    ]
  }, [tokensData, onchainPoolTokens, factoryTokens])

  const gtPricesQueries = useReactQueries({
    queries: (Object.keys(GT_NETWORK_IDS) as GqlChain[]).map(chain => ({
      queryKey: ['onchain-gt-prices', chain, gtPriceAddresses.join(',')],
      queryFn: async () => {
        const gt = await fetchGtTokenPrices(chain, gtPriceAddresses)
        return mergeOnchainTokenPrices([], gt, chain)
      },
      enabled: gtPriceAddresses.length > 0,
      staleTime: 60_000,
    })),
  })

  const gtPrices = useMemo(
    () =>
      gtPricesQueries
        .map(r => r.data)
        .filter((d): d is GqlTokenPrice[] => Array.isArray(d))
        .flat(),
    [gtPricesQueries]
  )

  // API prices WIN; GT only fills onchain-only gaps (never overrides).
  const mergedPrices = useMemo(() => {
    if (gtPrices.length === 0) return prices
    const known = new Set(prices.map(p => `${p.chain}:${p.address.toLowerCase()}`))
    return [...prices, ...gtPrices.filter(p => !known.has(`${p.chain}:${p.address.toLowerCase()}`))]
  }, [prices, gtPrices])

  const getToken = (address: string, chain: GqlChain | number): ApiToken | undefined => {
    const chainKey = typeof chain === 'number' ? 'chainId' : 'chain'
    return tokens.find(token => isSameAddress(token.address, address) && token[chainKey] === chain)
  }

  function getNativeAssetToken(chain: GqlChain | number) {
    return getToken(getNativeAssetAddress(chain), chain)
  }

  function getWrappedNativeAssetToken(chain: GqlChain | number) {
    return getToken(getWrappedNativeAssetAddress(chain), chain)
  }

  const getTokensByChain = useCallback(
    (chain: number | GqlChain): GqlToken[] => {
      const chainKey = typeof chain === 'number' ? 'chainId' : 'chain'
      const result = tokens.filter(token => token[chainKey] === chain)
      // Limit to 10 tokens in Anvil fork to avoid Swap performance issues
      return shouldUseAnvilFork ? result.slice(0, 10) : result
    },
    [tokens]
  )

  function usdValueForToken(token: ApiOrCustomToken | undefined, amount: Numberish) {
    if (!token) return '0'
    if (amount === '') return '0'
    if (typeof amount === 'string' && !isBnParseable(amount)) return '0'
    return bn(amount)
      .times(priceFor(token.address as Address, token.chain))
      .toFixed()
  }

  function usdValueForTokenAddress(
    address: string,
    chain: GqlChain,
    amount: Numberish,
    customUsdPrice?: string
  ) {
    if (amount === '') return '0'
    if (typeof amount === 'string' && !isBnParseable(amount)) return '0'
    return bn(amount)
      .times(customUsdPrice || priceFor(address, chain))
      .toFixed()
  }

  const priceFor = (address: string, chain: GqlChain): number => {
    const chainPrices = mergedPrices.filter(price => price.chain === chain)
    const price = chainPrices.find(price => isSameAddress(price.address, address))
    if (!price) return 0

    return price.price
  }

  const calcWeightForBalance = (
    tokenAddress: Address | string,
    tokenBalance: string,
    totalLiquidity: string,
    chain: GqlChain
  ): string => {
    const tokenPrice = priceFor(tokenAddress, chain)
    const totalLiquidityBn = bn(totalLiquidity || 0)

    if (totalLiquidityBn.isZero() || !isBnParseable(tokenBalance)) return '0'

    return bn(tokenPrice).times(tokenBalance).div(totalLiquidityBn).toString()
  }

  const calcTotalUsdValue = useCallback(
    (poolTokens: PoolToken[], chain: GqlChain) => {
      return poolTokens
        .reduce((total, token) => {
          if (!isBnParseable(token.balance)) return total
          return total.plus(bn(priceFor(token.address, chain)).times(token.balance))
        }, bn(0))
        .toString()
    },
    [priceFor]
  )

  const vebalBptToken = tokens.find(
    t => t.address === mainnetNetworkConfig.tokens.addresses.veBalBpt
  )

  return {
    tokens,
    prices,
    isLoadingTokenPrices,
    isLoadingTokens,
    getToken,
    getNativeAssetToken,
    getWrappedNativeAssetToken,
    priceFor,
    getTokensByChain,
    usdValueForToken,
    usdValueForTokenAddress,
    calcWeightForBalance,
    calcTotalUsdValue,
    startTokenPricePolling: () => startPolling(POLL_INTERVAL),
    stopTokenPricePolling: stopPolling,
    vebalBptToken,
  }
}

export function TokensProvider({ children }: PropsWithChildren) {
  const tokens = useTokensLogic()

  return <TokensContext.Provider value={tokens}>{children}</TokensContext.Provider>
}

export const useTokens = (): UseTokensResult => useMandatoryContext(TokensContext, 'Tokens')
