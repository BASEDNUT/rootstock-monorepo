import { withSentryConfig } from '@sentry/nextjs'
import { sentryOptions } from './sentry.config'
import type { NextConfig } from 'next'

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
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

  // Safe App setup
  headers: manifestHeaders,
  reactCompiler: true,
  redirects: async () => [
    {
      source: '/pools',
      destination: '/',
      permanent: true,
    },
    {
      source: '/pools/:path*',
      destination: '/',
      permanent: true,
    },
    {
      source: '/portfolio',
      destination: '/',
      permanent: true,
    },
    {
      source: '/portfolio/:path*',
      destination: '/',
      permanent: true,
    },
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
