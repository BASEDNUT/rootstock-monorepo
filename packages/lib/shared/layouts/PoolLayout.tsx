import { Pool, PoolVariant } from '@repo/lib/modules/pool/pool.types'
import { ChainSlug, getChainSlug, getPoolTypeLabel } from '@repo/lib/modules/pool/pool.utils'
import { PropsWithChildren, Suspense } from 'react'
import { PoolDetailSkeleton } from '@repo/lib/modules/pool/PoolDetail/PoolDetailSkeleton'
import { getApolloServerClient } from '@repo/lib/shared/services/api/apollo-server.client'
import { Metadata } from 'next'
import { PoolProvider } from '@repo/lib/modules/pool/PoolProvider'
import { arrayToSentence } from '@repo/lib/shared/utils/strings'
import { notFound } from 'next/navigation'
import { getUserReferenceTokens } from '@repo/lib/modules/pool/pool-tokens.utils'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { getPoolQuery } from '@repo/lib/modules/pool/queries/fetchPool'
import type { GetPoolQuery } from '@repo/lib/shared/services/api/generated/graphql'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import bakedPoolRegistry from '@repo/lib/modules/pool/baked-pool-registry.json'

type PoolLayoutProps = PropsWithChildren<{
  chain: ChainSlug
  id: string
  variant?: PoolVariant
}>

export type PoolMetadata = {
  metadata: Metadata
  pool?: Pool
}

export async function generatePoolMetadata({
  id,
  chain,
  variant,
}: PoolLayoutProps): Promise<PoolMetadata> {
  // Rootstock S100b (F7, 2026-09-23): onchain-only chains (BASESEP) bypass
  // the remote API for metadata too — the API does not know our pools, and
  // prerender-time metadata calls (~90 pages/build) triggered Cloudflare 429
  // rate-limits that killed builds. Metadata comes from the baked registry
  // (onchain-only law, same source as PoolLayout data).
  const _chain = getChainSlug(chain)
  let pool

  if (isOnchainOnlyNetwork(_chain)) {
    const baked = (bakedPoolRegistry as { pools: BakedPoolEntry[] }).pools.find(
      p => p.address.toLowerCase() === id.toLowerCase()
    )

    if (!baked) return { metadata: {} }

    const built = buildOnchainPoolData(baked, _chain) as unknown as {
      pool: Pool
    }

    pool = built.pool
  } else {
    const { data } = await getPoolQuery(getApolloServerClient(), chain, id)
    pool = data?.pool
  }

  if (!pool) return { metadata: {} }

  const displayTokens = getUserReferenceTokens(pool)
  const poolTokenString = arrayToSentence(displayTokens.map(token => token.symbol))
  const poolSymbol = PROJECT_CONFIG.options.showPoolName ? 'This' : pool.symbol // pool name is already shown in the title so we don't need to show it twice

  return {
    metadata: {
      title: `Liquidity Pool (${variant}): ${pool.name}`,
      description: `${poolSymbol} is a Balancer ${variant} ${getPoolTypeLabel(
        pool.type
      )} liquidity pool which contains ${poolTokenString}.`,
    },
    pool,
  }
}

export async function PoolLayout({ id, chain, variant, children }: PoolLayoutProps) {
  const _chain = getChainSlug(chain)

  // Rootstock S100 (IPFS export): onchain-only chains (BASESEP) bypass the
  // remote API entirely — pool data comes from the baked registry. The API
  // does not know our pools and would trigger notFound() at build time.
  let data

  if (isOnchainOnlyNetwork(_chain)) {
    const baked = (bakedPoolRegistry as { pools: BakedPoolEntry[] }).pools.find(
      p => p.address.toLowerCase() === id.toLowerCase()
    )

    if (!baked) {
      notFound()
    }

    data = buildOnchainPoolData(baked, _chain) as unknown as GetPoolQuery
  } else {
    const result = await getPoolQuery(getApolloServerClient(), chain, id)
    data = result.data
    const error = result.error

    if (error) {
      if (error?.message === 'Pool with id does not exist') {
        notFound()
      }

      throw new Error('Failed to fetch pool')
    } else if (!data) {
      throw new Error('Failed to fetch pool')
    }
  }

  return (
    <Suspense fallback={<PoolDetailSkeleton />}>
      <PoolProvider chain={_chain} data={data} id={id} variant={variant}>
        {children}
      </PoolProvider>
    </Suspense>
  )
}

// ─── Rootstock S100: onchain-only pool data (BASESEP) ───

interface BakedPoolTokenEntry {
  address: string
  symbol?: string
  name?: string
  decimals?: number
}

interface BakedPoolEntry {
  address: string
  factory: string
  blockNumber: number
  type: string
  name?: string
  symbol?: string
  // S100b audit fix F6: tokens may be legacy strings or enriched objects
  tokens?: (string | BakedPoolTokenEntry)[]
  // S101 (D1/D3 fix): blockTimestamp = unix seconds of the pool-creation
  // block; swapFee = decimal-fraction string ('0.003' = 0.3%).
  blockTimestamp?: number
  swapFee?: string
}

function buildOnchainPoolData(
  baked: BakedPoolEntry,
  chain: string
): { pool: Record<string, unknown> } {
  return {
    pool: {
      __typename: 'GqlPool',
      address: baked.address,
      chain,
      createTime: baked.blockTimestamp ?? baked.blockNumber,
      decimals: 18,
      dynamicData: {
        aprItems: [],
        fees24h: '0',
        holdersCount: '0',
        isInRecoveryMode: false,
        isPaused: false,
        poolId: baked.address,
        surplus24h: '0',
        swapEnabled: true,
        // S101 (D3 fix): bake the real static swap fee (decimal-fraction
        // string, '0.003' = 0.3%); '0' was a hardcoded placeholder that
        // rendered '0% (undefined)' while chain truth is 0.3%.
        swapFee: baked.swapFee ?? '0',
        totalLiquidity: '0',
        totalShares: '0',
        volume24h: '0',
      },
      factory: baked.factory,
      hasErc4626: false,
      hasNestedErc4626: false,
      hook: null,
      id: baked.address,
      liquidityManagement: { disableUnbalancedLiquidity: false },
      name: baked.name || baked.symbol || baked.address,
      owner: null,
      pauseManager: null,
      poolCreator: null,
      poolTokens: (baked.tokens || []).map((token, index) => {
        // S100b audit fix F6: registry tokens may be enriched objects
        // ({address, symbol, name, decimals}) or legacy strings.
        const t = typeof token === 'string' ? { address: token } : token
        return {
          id: `${baked.address}-${index}`,
          chain,
          chainId: 84532,
          address: t.address,
          decimals: t.decimals ?? 18,
          name: t.name || '',
          symbol: t.symbol || '',
          priority: 0,
          tradable: true,
          canUseBufferForSwaps: false,
          useWrappedForAddRemove: false,
          useUnderlyingForAddRemove: false,
          index,
          balance: '0',
          balanceUSD: '0',
          priceRate: '1',
          weight: '0',
          hasNestedPool: false,
          isAllowed: true,
          priceRateProvider: null,
          logoURI: '',
          priceRateProviderData: null,
          nestedPool: null,
          isErc4626: false,
          maxDeposit: null,
          maxWithdraw: null,
          isBufferAllowed: false,
          underlyingToken: null,
          erc4626ReviewData: null,
        }
      }),
      protocolVersion: 3,
      staking: null,
      swapFeeManager: null,
      symbol: baked.symbol || '',
      tags: [],
      type: baked.type,
      userBalance: null,
      version: 0,
    },
  }
}
