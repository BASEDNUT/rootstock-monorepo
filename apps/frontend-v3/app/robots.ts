import { MetadataRoute } from 'next'

// S107 (Boss 2026-09-29): no DNS host exists for this app — hosting is IPFS,
// a new CID is published per build, so there is no stable sitemap URL.
// robots stays rule-only until a real host exists.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
  }
}
