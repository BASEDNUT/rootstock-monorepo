import { useQuery } from '@apollo/client/react'
import { GetProtocolStatsDocument } from '../services/api/generated/graphql'
import { PROJECT_CONFIG, toApiNetworks } from '@repo/lib/config/getProjectConfig'

export function useProtocolStats() {
  const statQuery = useQuery(GetProtocolStatsDocument, {
    variables: {
      chains: toApiNetworks(PROJECT_CONFIG.supportedNetworks),
    },
  })

  return {
    statQuery,
  }
}
