import { useQueryClient } from '@tanstack/react-query'

/** S106: query key of the factory-token discovery (TokensProvider merge). */
export const FACTORY_TOKENS_QUERY_KEY = ['onchain-factory-tokens', 'basesep'] as const

/**
 * S106 (PRD-07 pickers law): after a successful factory create, invalidate
 * the discovery query — the new token/wrapper then appears in every picker
 * without any registry edit.
 */
export function useInvalidateFactoryTokens() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: FACTORY_TOKENS_QUERY_KEY })
}
