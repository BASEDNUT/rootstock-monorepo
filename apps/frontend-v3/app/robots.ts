import { MetadataRoute } from 'next'

// S100 export law (restored S108): metadata routes must be force-static for
// output:export — dropped by the S107 env-gated rewrite, main was never
// export-built before S108, so the regression shipped unnoticed.
export const dynamic = 'force-static'

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
