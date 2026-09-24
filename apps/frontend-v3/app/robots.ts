import { MetadataRoute } from 'next'

// Rootstock S100 (IPFS export): metadata routes must be force-static for output:export
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://balancer.fi/sitemap.xml',
  }
}
