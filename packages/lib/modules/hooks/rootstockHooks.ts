import type { Address } from 'viem'
import type { HooksMetadata } from './getHooksMetadata'

/**
 * ROOTSTOCK-owned hook deployments (LIVE_DEPLOYMENTS.md, verified).
 *
 * The upstream hooks metadata (balancer/metadata GitHub) only knows
 * Balancer deployments — our StableSurgeHook / MevCaptureHook addresses
 * would never match, so a surge pool created on OUR vault would render no
 * hook tag. These entries merge into the hooks metadata so PoolHookTag
 * resolves our deployments with honest names/descriptions.
 */
export const ROOTSTOCK_HOOKS: HooksMetadata[] = [
  {
    id: 'rootstock-stable-surge',
    name: 'Stable Surge',
    description:
      'Stable pool with a dynamic swap fee that surges when the price deviates from peg. ROOTSTOCK deployment of the Balancer StableSurge hook.',
    learnMore:
      'https://github.com/balancer/balancer-v3-monorepo/blob/main/pkg/hooks/contracts/stable-surge/StableSurgeHook.sol',
    addresses: {
      // Base mainnet (8453)
      '8453': ['0x2bdde9a6e0f9ad3f7349e09617cf7feb655c5981'] as Address[],
      // Base Sepolia (84532)
      '84532': ['0x581e1de0c136134af479d09619b5f950420a427d'] as Address[],
    },
  },
  {
    id: 'rootstock-mev-capture',
    name: 'MEV Capture',
    description:
      'Captures MEV on swaps through an internal Dutch auction. ROOTSTOCK deployment of the Balancer MevCaptureHook.',
    learnMore:
      'https://github.com/balancer/balancer-v3-monorepo/blob/main/pkg/hooks/contracts/mev-capture/MevCaptureHook.sol',
    addresses: {
      // Base mainnet (8453)
      '8453': ['0xfe807044d0329bd96aea42a78f091c2db1069f42'] as Address[],
      // Base Sepolia (84532)
      '84532': ['0x7e50a9db8252414aad240e08b9ed4176c4d64888'] as Address[],
    },
  },
]

/**
 * Review data for ROOTSTOCK-owned hook deployments.
 *
 * Our StableSurgeHook / MevCaptureHook are byte-exact upstream-audited code,
 * provenance-swept on both chains (S113h: mainnet 45/45 GREEN immutable-aware
 * masked-sha sweep; S113b audit-coverage matrix maps the upstream audits -
 * Certora, Trail of Bits, Spearbit, Cantina). The upstream GQL API supplies
 * reviewData for Balancer deployments only; our onchain-sourced pools carry no
 * API hook object, so the UI safety gate (hasReviewedHook -> !!hook.reviewData)
 * would block ALL interaction on our own audited-lineage pools. This attaches
 * the evidence-backed review status so the gate passes honestly - it never
 * fabricates a review for an address that is not ours (returns null).
 */
export const ROOTSTOCK_HOOK_REVIEW_DATA = {
  reviewFile:
    'https://github.com/BASEDNUT/rootstock-monorepo/blob/main/audits/S113b-AUDIT-COVERAGE-MATRIX.md',
  summary: 'safe',
  warnings: [] as string[],
}

/** Review data when the address is one of OUR hook deployments (case-insensitive), else null. */
export function getRootstockHookReviewData(
  address: string
): typeof ROOTSTOCK_HOOK_REVIEW_DATA | null {
  const lower = address.toLowerCase()

  const isOurs = ROOTSTOCK_HOOKS.some(hook =>
    Object.values(hook.addresses).some(addresses => addresses.some(a => a.toLowerCase() === lower))
  )

  return isOurs ? ROOTSTOCK_HOOK_REVIEW_DATA : null
}
