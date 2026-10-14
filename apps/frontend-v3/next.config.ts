import { withSentryConfig } from '@sentry/nextjs'
import { sentryOptions } from './sentry.config'
import type { NextConfig } from 'next'

/**
 * Rootstock (TODO 5.10): IPFS static-export mode.
 * ROOTSTOCK_EXPORT=1 → output:'export' (full static site for IPFS freeze).
 * - images.unoptimized: no server-side image optimizer exists on IPFS
 * - redirects/headers dropped: server features, unsupported in export mode
 * - app/api routes are moved aside by scripts/build-ipfs.sh during export
 * - subdomain-gateway doctrine: root-relative asset paths work at
 *   https://<CID>.ipfs.<gateway>/ (research: subdomain gateways only)
 * Dev server (next dev) is unaffected — mode only activates at build time.
 */
const isIpfsExport = process.env.ROOTSTOCK_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // audit fix (2026-09-23): trailingSlash:true so export emits <route>/index.html.
  // Without it, static servers and IPFS path-gateways resolve /pools to a raw directory
  // listing (route.html + route/ dir, no index) — directory-listing bug, verified live.
  ...(isIpfsExport
    ? {
        output: 'export' as const,
        trailingSlash: true,
        // full-page links on the ship — next/link imports are
        // rewritten at build time (scripts/build-ipfs.sh
        // rewrite_link_imports); turbopack resolveAlias for the
        // next-internal 'next/link' module fails silently (verified
        // zero data-ipfs-link baked, both relative and
        // absolute forms).
      }
    : {}),
  serverExternalPackages: ['thread-stream', 'real-require', 'encoding'],
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    // Remote-host allowlist is dev-surface only (image proxy + optimizer
    // pipeline). The static export runs unoptimized — no optimizer, no /api
    // proxy exists on gateways — so no arbitrary-host allowlist bakes into
    // the shipped build.
    ...(isIpfsExport
      ? {}
      : {
          remotePatterns: [
            {
              protocol: 'https',
              hostname: '**',
            },
          ],
        }),
    localPatterns: [
      {
        pathname: '/api/proxy/image/**',
      },
      {
        pathname: '/images/**',
      },
    ],
    minimumCacheTTL: 60,
    // static export has no /_next/image optimizer — without this,
    // remote token logos 404 through /_next/image/?url=... on gateways.
    ...(isIpfsExport ? { unoptimized: true } : {}),
  },
  transpilePackages: ['@repo/lib'],

  // Safe App setup (server features — skipped in IPFS export mode)
  ...(!isIpfsExport ? { headers: manifestHeaders } : {}),
  reactCompiler: true,
  ...(!isIpfsExport
    ? {
        redirects: async () => [
          {
            source: '/vebal',
            destination: '/',
            permanent: true,
          },
          {
            source: '/vebal/:path*',
            destination: '/',
            permanent: true,
          },
          {
            source: '/testooors',
            destination: '/debug',
            permanent: false,
          },
          {
            source: '/components',
            destination: '/',
            permanent: false,
          },
        ],
      }
    : {}),
}

// Avoid sentry setup in CI
const config = process.env.CI === 'true' ? nextConfig : withSentryConfig(nextConfig, sentryOptions)

export default config

/**
 * Add specific CORS headers to the manifest.json file
 * This is required to allow the Safe Browser to fetch the manifest file
 * More info: https://help.safe.global/en/articles/40859-add-a-custom-safe-app
 */
async function manifestHeaders() {
  const corsHeaders = [
    {
      key: 'Access-Control-Allow-Origin',
      value: '*',
    },
    {
      key: 'Access-Control-Allow-Methods',
      value: 'GET',
    },
    {
      key: 'Access-Control-Allow-Headers',
      value: 'X-Requested-With, content-type, Authorization',
    },
  ]

  return [
    {
      source: '/manifest.json',
      headers: corsHeaders,
    },
  ]
}
