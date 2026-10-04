'use client'

import { useQuery } from '@tanstack/react-query'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { fetchDiscoveredPools } from './onchain-pool-fetch'

/**
 * Rootstock: onchain pool discovery (React hook wrapper).
 * Fetch logic lives in onchain-pool-fetch.ts (shared with OnchainSwapHandler).
 * NEVER the remote API (onchain-only law, S100).
 *
 * S113d (2026-10-03): both Rootstock chains are live — Base mainnet (S113c)
 * + Base Sepolia (S95). Default fetches BOTH; callers may pass specific
 * chains (pools list passes the user's selection).
 */
export function useOnchainPoolDiscovery(enabled: boolean, chains?: GqlChain[]) {
  const targetChains = chains ?? [GqlChainValues.Base, GqlChainValues.BaseSepolia]
  return useQuery({
    queryKey: ['onchain-pool-discovery', targetChains.join(',')],
    queryFn: async () => {
      const results = await Promise.all(targetChains.map(c => fetchDiscoveredPools(c)))
      return results.flat()
    },
    enabled,
    staleTime: 60_000,
  })
}
