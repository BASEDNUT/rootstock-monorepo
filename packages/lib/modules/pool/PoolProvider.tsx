'use client'

import {
  GetFeaturedPoolsQuery,
  GetPoolDocument,
  GetPoolQuery,
  GqlChain,
} from '@repo/lib/shared/services/api/generated/graphql'
import { createContext, PropsWithChildren, useMemo, useRef } from 'react'
import { useQuery } from '@apollo/client/react'
import { FetchPoolProps, Pool } from './pool.types'
import { useMandatoryContext } from '@repo/lib/shared/utils/contexts'
import { getPoolHelpers } from './pool.helpers'
import { useUserAccount } from '@repo/lib/modules/web3/UserAccountProvider'
import { usePoolEnrichWithOnChainData } from './queries/usePoolEnrichWithOnChainData'
import { useOnchainUserPoolBalances } from './queries/useOnchainUserPoolBalances'
import { useOnchainPoolMetrics } from './useOnchainPoolMetrics'
import { mergeOnchainPoolMetrics } from './onchain-detail-metrics'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { useInvalidVariantRedirect } from './pool.hooks'
import { useTokens } from '../tokens/TokensProvider'
import { getCompositionTokens } from './pool-tokens.utils'
import { removeHookDataFromPoolIfNecessary } from './pool.utils'

export type FeaturedPool = GetFeaturedPoolsQuery['featuredPools'][0]['pool']
export type UsePoolResponse = ReturnType<typeof usePoolLogic> & {
  chain: GqlChain
}

export const PoolContext = createContext<UsePoolResponse | null>(null)

export function usePoolLogic({
  id,
  chain,
  initialData,
}: FetchPoolProps & { initialData: GetPoolQuery }) {
  const { userAddress } = useUserAccount()
  const { priceFor, calcTotalUsdValue } = useTokens()
  const myLiquiditySectionRef = useRef<HTMLDivElement | null>(null)
  const myLbpTransactionsSectionRef = useRef<HTMLDivElement | null>(null)

  useInvalidVariantRedirect(initialData.pool)

  const { data } = useQuery(GetPoolDocument, {
    variables: { id, chain, userAddress: userAddress.toLowerCase() },
  })

  const poolData = removeHookDataFromPoolIfNecessary(data?.pool || initialData.pool)

  // D1 (2026-10-27): onchain-only pools render a stub dynamicData from the
  // baked registry (volume24h '0' — a fabricated zero). The list enriches
  // with useOnchainPoolMetrics; detail must use the SAME source so the two
  // surfaces never contradict (live-caught: tsPHILO detail $0.00 vs list $2.02).
  const onchainOnly = isOnchainOnlyNetwork(chain)

  const metricsInput = useMemo(() => {
    if (!onchainOnly || !poolData) return []
    return [
      {
        id: poolData.address,
        address: poolData.address,
        chain,
        type: poolData.type,
        protocolVersion: 3,
        symbol: poolData.symbol || '',
        name: poolData.name || poolData.symbol || poolData.address,
        factory: poolData.factory || poolData.address,
        createTime: Number(poolData.createTime) || 0,
        poolTokens: (poolData.poolTokens || []).map(
          (t: { address: string; symbol?: string; name?: string; decimals?: number }) => ({
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            decimals: t.decimals,
          })
        ),
        hook: null,
        tags: [],
        dynamicData: {
          totalLiquidity: null,
          volume24h: null,
          fees24h: null,
          aprItems: [],
        },
      },
    ] as never[]
  }, [onchainOnly, poolData, chain])

  const { data: detailMetrics } = useOnchainPoolMetrics(onchainOnly, [chain], metricsInput)

  const {
    pool: poolWithOnChainData,
    refetch: refetchOnchainData,
    isLoading: isLoadingOnchainData,
  } = usePoolEnrichWithOnChainData(poolData as Pool)

  const {
    data: [poolWithOnchainUserBalances],
    refetch: refetchOnchainUserBalances,
    isLoading: isLoadingOnchainUserBalances,
  } = useOnchainUserPoolBalances([poolWithOnChainData || poolData])

  const pool = poolWithOnchainUserBalances || poolWithOnChainData || poolData

  // D1: merge onchain metrics (volume/fees/TVL/APR) for onchain-only pools —
  // the baked-registry stub says '0'; the metrics source carries the truth
  // (or an honest null). Detail and list must never contradict.
  const poolWithDetailMetrics =
    onchainOnly && detailMetrics?.pools
      ? (mergeOnchainPoolMetrics(pool as never, detailMetrics.pools) as unknown as Pool)
      : pool

  const bptPrice = priceFor(poolWithDetailMetrics.address, poolWithDetailMetrics.chain)

  const tvl = calcTotalUsdValue(
    getCompositionTokens(poolWithDetailMetrics),
    poolWithDetailMetrics.chain
  )

  const isLoading = isLoadingOnchainData || isLoadingOnchainUserBalances

  const refetch = async () => {
    return Promise.all([refetchOnchainData(), refetchOnchainUserBalances()])
  }

  return {
    pool: poolWithDetailMetrics,
    bptPrice,
    tvl,
    isLoading,
    isLoadingOnchainData,
    isLoadingOnchainUserBalances,
    myLiquiditySectionRef,
    myLbpTransactionsSectionRef,
    // TODO: we assume here that we never need to reload the entire pool.
    // this assumption may need to be questioned
    refetch,
    ...getPoolHelpers(poolWithDetailMetrics, chain),
  }
}

export function PoolProvider({
  id,
  chain,
  variant,
  children,
  data,
}: PropsWithChildren<FetchPoolProps> & { data: GetPoolQuery }) {
  const hook = usePoolLogic({ id, chain, variant, initialData: data })
  return <PoolContext.Provider value={{ ...hook, chain }}>{children}</PoolContext.Provider>
}

export const usePool = (): UsePoolResponse => useMandatoryContext(PoolContext, 'Pool')
