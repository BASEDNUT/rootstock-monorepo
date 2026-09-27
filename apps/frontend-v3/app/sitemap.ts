import { MetadataRoute } from 'next'

// Rootstock S100 (IPFS export): metadata routes must be force-static for output:export
export const dynamic = 'force-static'

// S102 (Boss 2026-09-26, boat integrity): full core-route coverage.
const ROUTES: Array<{ route: string; priority: number }> = [
  { route: '/swap', priority: 0.9 },
  { route: '/create', priority: 0.9 },
  { route: '/pools', priority: 0.9 },
  { route: '/portfolio', priority: 0.8 },
  { route: '/nutusd', priority: 0.8 },
  { route: '/lbp/create', priority: 0.8 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://rootstock.basednut.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...ROUTES.map(({ route, priority }) => ({
      url: `${base}${route}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority,
    })),
  ]
}
