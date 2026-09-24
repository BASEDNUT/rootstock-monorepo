import { UnstakePage } from '@repo/lib/shared/pages/UnstakePage'

// Rootstock S100 (IPFS export): mirror the pool-detail static params.
import bakedPoolRegistry from '@repo/lib/modules/pool/baked-pool-registry.json'

export function generateStaticParams() {
  const chains = ['base-sepolia']
  const variants = ['v3']
  const pools = (bakedPoolRegistry as { pools: { address: string }[] }).pools
  return chains.flatMap(chain =>
    variants.flatMap(variant => pools.map(pool => ({ chain, variant, id: pool.address })))
  )
}



export default function UnstakePageWrapper() {
  return <UnstakePage />
}
