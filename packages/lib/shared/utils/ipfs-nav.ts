/**
 * S109 (Boss live E2E walk 2026-09-30): full-page navigation helper for the
 * IPFS static export. The export ships no server — client-router RSC
 * payload fetches 404 on gateways and clicks dead-end. On the ship every
 * navigation is a full-page load; dev builds keep the native router.
 */
export function isIpfsExportMode(): boolean {
  return process.env.NEXT_PUBLIC_IPFS_EXPORT === '1'
}

export function navTo(router: { push: (href: string) => void }, path: string): void {
  if (isIpfsExportMode()) {
    window.location.assign(path)
    return
  }

  router.push(path)
}
