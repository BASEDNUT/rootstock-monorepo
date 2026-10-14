import { useQueryClient } from '@tanstack/react-query'
import { getGqlChain } from '@repo/lib/config/app.config'

/** FIX-7: per-chain factory-token query keys (TokensProvider merge). */
export function factoryTokensQueryKey(chainId: number) {
  return ['onchain-factory-tokens', getGqlChain(chainId as 8453 | 84532)] as const
}

/**
 * FIX-7 (PRD-07 pickers law): after a successful factory create,
 * invalidate the chain-matching discovery query — the new token/wrapper
 * then appears in every picker without any registry edit.
 */
export function useInvalidateFactoryTokens() {
  const queryClient = useQueryClient()
  return (chainId: number) =>
    queryClient.invalidateQueries({ queryKey: factoryTokensQueryKey(chainId) })
}
