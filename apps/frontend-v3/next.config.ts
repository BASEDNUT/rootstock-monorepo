import { withSentryConfig } from '@sentry/nextjs'
import { sentryOptions } from './sentry.config'
import type { NextConfig } from 'next'

/**
 * Rootstock S100 (TODO 5.10): IPFS static-export mode.
 * ROOTSTOCK_EXPORT=1 → output:'export' (full static site for IPFS freeze).
 * - images.unoptimized: no server-side image optimizer exists on IPFS
 * - redirects/headers dropped: server features, unsupported in export mode
 * - app/api routes are moved aside by scripts/build-ipfs.sh during export
 * - subdomain-gateway doctrine: root-relative asset paths work at
 *   https://<CID>.ipfs.<gateway>/ (S100 research: subdomain gateways only)
 * Dev server (next dev) is unaffected — mode only activates at build time.
 */
const isIpfsExport = process.env.ROOTSTOCK_EXPORT === '1'

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  ...(isIpfsExport ? { output: 'export' as const, images: { unoptimized: true } } : {}),
  serverExternalPackages: ['thread-stream', 'real-require', 'encoding'],
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/proxy/image/**',
      },
      {
        pathname: '/images/**',
      },
    ],
    minimumCacheTTL: 60,
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
      } : {}),
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
