import { MetadataRoute } from 'next'

// S100 export law (restored S108): metadata routes must be force-static for
// output:export — dropped by the S107 env-gated rewrite, main was never
// export-built before S108, so the regression shipped unnoticed.
export const dynamic = 'force-static'

// S107 (Boss 2026-09-29): no DNS host exists — hosting is IPFS, a new CID
// is minted per build, so there is no stable base URL to hardcode. When
// NEXT_PUBLIC_SITE_URL is set (a real host, future) entries are generated
// from it; otherwise the sitemap is EMPTY in static export. No fabricated
// hosts, ever.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

const ROUTES = [
  '/',
  '/swap',
  '/create',
  '/pools',
  '/portfolio',
  '/nutusd',
  '/lbp/create',
  '/mint',
  '/wrap',
]

export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_URL) return []
  const base = `https://${SITE_URL}`
  return ROUTES.map(route => ({
    url: route === '/' ? base : `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority:
      route === '/' ? 1 : route.startsWith('/swap') || route.startsWith('/create') ? 0.9 : 0.8,
  }))
}
