import { PoolContainer } from '@repo/lib/modules/pool/PoolContainer'
import { TransactionStateProvider } from '@repo/lib/modules/transactions/transaction-steps/TransactionStateProvider'

// Rootstock S100 (IPFS export): baked pool registry drives static params —
// the 9 live Base Sepolia pools. New pools post-freeze need a registry re-bake
// (regenerate-baked-registry.mjs) before the next export.
import bakedPoolRegistry from '@repo/lib/modules/pool/baked-pool-registry.json'

export function generateStaticParams() {
  const chains = ['base-sepolia']
  const variants = ['v3']
  const pools = (bakedPoolRegistry as { pools: { address: string }[] }).pools
  return chains.flatMap(chain =>
    variants.flatMap(variant => pools.map(pool => ({ chain, variant, id: pool.address })))
  )
}



export default function PoolPage() {
  return (
    <TransactionStateProvider>
      <PoolContainer />
    </TransactionStateProvider>
  )
}
