import { ProjectConfigBeets } from './projects/beets'
import { ProjectConfigBalancer } from './projects/balancer'
import { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { ProjectConfig } from './config.types'

const PROJECT_CONFIGS = {
  [ProjectConfigBalancer.projectId]: ProjectConfigBalancer,
  [ProjectConfigBeets.projectId]: ProjectConfigBeets,
}

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID as ProjectConfig['projectId']

export const isBalancer = projectId === ProjectConfigBalancer.projectId
export const isBeets = projectId === ProjectConfigBeets.projectId
export const PROJECT_CONFIG = PROJECT_CONFIGS[projectId] ?? ProjectConfigBalancer


/**
 * Networks that can be queried from the remote API. Onchain-only networks
 * (e.g. our Base Sepolia deployment) are excluded: the upstream API does not
 * know them and must never receive them as query variables.
 */
export function toApiNetworks(chains: GqlChain[]): GqlChain[] {
  const onchainOnly = new Set(PROJECT_CONFIG.onchainOnlyNetworks || [])
  return chains.filter(chain => !onchainOnly.has(chain))
}

export function isOnchainOnlyNetwork(chain: GqlChain): boolean {
  const onchainOnly = new Set(PROJECT_CONFIG.onchainOnlyNetworks || [])
  return onchainOnly.has(chain)
}
