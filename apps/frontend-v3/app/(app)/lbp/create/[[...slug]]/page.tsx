import LbpCreationPage from '@repo/lib/modules/lbp/LbpCreationPage'

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
    // S101c fix: LBP wizard redirects to step URLs; prerender them.
    { slug: ['step-1-sale-structure'] },
    { slug: ['step-2-project-info'] },
    { slug: ['step-3-review'] },
  ]
}

export default function LBPCreatePageWrapper() {
  return <LbpCreationPage />
}
