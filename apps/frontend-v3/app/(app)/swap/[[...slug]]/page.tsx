import { SwapForm } from '@repo/lib/modules/swap/SwapForm'
import { Metadata } from 'next'

// Rootstock S100 (IPFS export): enumerate common in-app URL states. The app
// updates URL via history.replaceState (no RSC fetch) so arbitrary deep links
// are not pre-rendered; these cover the entry states users reach in-app.
export function generateStaticParams() {
  return [
    { slug: [] },
    { slug: ['base'] },
    { slug: ['base', 'ETH'] },
    { slug: ['base-sepolia', 'ETH'] },
    { slug: ['base', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] },
    { slug: ['base-sepolia', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'] },
  ]
}



export const metadata: Metadata = {
  title: 'Swap tokens on ROOTSTOCK',
  description: `Swap tokens on networks like Ethereum, Optimism, Arbitrum and Base on the ROOTSTOCK engine`,
}

export default function SwapPage() {
  return <SwapForm />
}
