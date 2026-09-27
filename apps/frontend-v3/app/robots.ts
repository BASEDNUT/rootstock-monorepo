import { MetadataRoute } from 'next'

// Rootstock S100 (IPFS export): metadata routes must be force-static for output:export
export const dynamic = 'force-static'

// S102 (Boss 2026-09-26, boat integrity): robots pointed at the upstream
// sitemap — a site↔upstream relationship leak. Own ship, own
// sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://rootstock.basednut.com/sitemap.xml',
  }
}
