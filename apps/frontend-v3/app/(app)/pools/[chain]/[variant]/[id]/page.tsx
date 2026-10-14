import { PoolContainer } from '@repo/lib/modules/pool/PoolContainer'
import { TransactionStateProvider } from '@repo/lib/modules/transactions/transaction-steps/TransactionStateProvider'

// Rootstock (IPFS export): per-chain baked registries drive static
// params — Sepolia (baked-pool-registry.json) + Base mainnet
// (baked-pool-registry-base.json). Slug values verified against ChainSlug
// (pool.utils.ts): Base = 'base', Base Sepolia = 'base-sepolia'.
//
// FIX-6 known limitation (documented, not solved): pools created after
// a bake lack static detail pages until re-bake + re-export — the standing
// re-bake law. The live-scan list still shows them; their detail deep-links
// 404 in the static export until the next bake cycle.
import bakedPoolRegistrySepolia from '@repo/lib/modules/pool/baked-pool-registry.json'
import bakedPoolRegistryBase from '@repo/lib/modules/pool/baked-pool-registry-base.json'

export function generateStaticParams() {
  const chains = ['base-sepolia', 'base']

  const variants = ['v3']

  const poolsByChain: Record<string, { address: string }[]> = {
    'base-sepolia': (bakedPoolRegistrySepolia as { pools: { address: string }[] }).pools,
    base: (bakedPoolRegistryBase as { pools: { address: string }[] }).pools,
  }

  return chains.flatMap(chain =>
    variants.flatMap(variant =>
      // chains is a literal covered by poolsByChain — non-null assert
      poolsByChain[chain]!.map(pool => ({ chain, variant, id: pool.address }))
    )
  )
}

export default function PoolPage() {
  return (
    <TransactionStateProvider>
      <PoolContainer />
    </TransactionStateProvider>
  )
}
