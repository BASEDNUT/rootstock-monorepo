'use client'

import { useQuery } from '@tanstack/react-query'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { fetchDiscoveredPools } from './onchain-pool-fetch'

/**
 * Rootstock: onchain pool discovery for BASESEP (React hook wrapper).
 * Fetch logic lives in onchain-pool-fetch.ts (shared with OnchainSwapHandler).
 * NEVER the remote API (onchain-only law, S100).
 */
export function useOnchainPoolDiscovery(enabled: boolean) {
  return useQuery({
    queryKey: ['onchain-pool-discovery', 'basesep'],
    queryFn: () => fetchDiscoveredPools(GqlChainValues.BaseSepolia),
    enabled,
    staleTime: 60_000,
  })
}
