import PoolCreationPage from '@repo/lib/shared/pages/PoolCreationPage'

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



export default async function PoolCreationPageWrapper() {
  return <PoolCreationPage />
}
