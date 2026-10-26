import {
  fetchAndMapMetadata,
  lowerCaseAddresses,
} from '@repo/lib/shared/utils/fetchAndLowercaseAddresses'
import { Address } from 'viem'
import { ROOTSTOCK_HOOKS } from './rootstockHooks'

const HOOKS_METADATA_URL =
  'https://raw.githubusercontent.com/balancer/metadata/refs/heads/main/hooks/index.json'

export type HooksMetadata = {
  id: string
  name: string
  description: string
  learnMore?: string
  addresses: Record<string, Address[]> // chainId -> addresses[]
}

export async function getHooksMetadata(): Promise<HooksMetadata[] | undefined> {
  // Rootstock (2026-10-26): merge OUR hook deployments into the metadata —
  // the upstream registry only knows Balancer deployments, so our
  // StableSurgeHook / MevCaptureHook would never match (browser-verified:
  // surge pool rendered no hook tag). Upstream entries win on id conflicts.
  const upstream = await fetchAndMapMetadata<HooksMetadata>(HOOKS_METADATA_URL, lowerCaseAddresses)

  if (!upstream) return ROOTSTOCK_HOOKS

  const upstreamIds = new Set(upstream.map(h => h.id))
  return [...upstream, ...ROOTSTOCK_HOOKS.filter(h => !upstreamIds.has(h.id))]
}
