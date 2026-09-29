import { NotFoundPageClient } from './NotFoundPageClient'

/**
 * Rootstock S100 (IPFS export): fully static — the upstream version read the
 * referer via next/headers (dynamic API), which breaks output:'export' when a
 * pool page calls notFound() at build time. Pool-id detection moved into the
 * client component via usePathname/useSearchParams (same UX, zero dynamic).
 */
export function NotFoundPage() {
  return <NotFoundPageClient description="" redirectText="" redirectUrl="/" title="" />
}
