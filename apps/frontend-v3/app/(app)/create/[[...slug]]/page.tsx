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
    // S101c fix (Boss GO 2026-09-25): wizard redirects /create -> /create/step-1-type;
    // step URLs must prerender or the redirect dead-ends in a 404 on static export.
    { slug: ['step-1-type'] },
    { slug: ['step-2-tokens'] },
    { slug: ['step-3-details'] },
    { slug: ['step-4-fund'] },
  ]
}

export default async function PoolCreationPageWrapper() {
  return <PoolCreationPage />
}
