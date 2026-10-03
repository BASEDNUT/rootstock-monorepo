'use client'

import { Skeleton } from '@chakra-ui/react'
import type { GetFeaturedPoolsQuery } from '@repo/lib/shared/services/api/generated/graphql'
import { FeaturedPools } from '@repo/lib/modules/featured-pools/FeaturedPools'
import { useOnchainPoolDiscovery } from '@repo/lib/modules/pool/useOnchainPoolDiscovery'

/**
 * Rootstock port of Balancer's featured-pools band (Boss 2026-10-02):
 * upstream FeaturedPools + PoolCarousel + FeaturePoolCard + graphics are
 * used VERBATIM — only the data source is adapted to our onchain discovery
 * (S100 onchain-only law, no remote API, no fabricated stats).
 *
 * Tailoring:
 * - dynamicData is stripped from each pool so PoolName never renders the
 *   APR sparkles tooltip (our pools carry a zero-stub — an APR label would
 *   be fabricated data).
 * - featuredReason is factual: discovered-onchain + pool type.
 */
export function OnchainFeaturedPools() {
  const { data: pools, isLoading } = useOnchainPoolDiscovery(true)
  const discovered = pools ?? []

  if (isLoading) {
    return <Skeleton height="327px" width="100%" />
  }

  if (discovered.length === 0) return null

  const featuredPools = discovered.map(pool => ({
    description: `Discovered onchain · ${pool.type.replace(/_/g, ' ').toLowerCase()}`,
    pool: {
      ...pool,
      dynamicData: undefined,
    },
  })) as unknown as GetFeaturedPoolsQuery['featuredPools']

  return <FeaturedPools featuredPools={featuredPools} />
}
