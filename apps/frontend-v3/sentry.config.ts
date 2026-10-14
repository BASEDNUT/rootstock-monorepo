import type { SentryBuildOptions } from '@sentry/nextjs/build/types/config/types'

/**
 * Telemetry destination policy (auditor L2, 2026-10-13): Rootstock ships NO
 * telemetry destination. The upstream Balancer telemetry targets were
 * removed — a non-export production deploy must never route user data to a
 * third party's account. The structural IPFS-export guard in
 * instrumentation-client stays the primary off-switch; an undefined DSN
 * additionally makes every Sentry.init a no-op.
 */

/** @type {import('@sentry/nextjs/build/types/config/types').SentryBuildOptions} */
export const sentryOptions: SentryBuildOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // Routes browser requests through a Next.js rewrite to circumvent ad-blockers (increases server load)
  tunnelRoute: '/monitoring',
  // No telemetry destination: source maps are never generated or uploaded
  sourcemaps: { disable: true },
  telemetry: false,
}

/**
 * No DSN: Sentry never transmits. Combined with the structural IPFS-export
 * guard this makes telemetry-off the default in every environment.
 */
export const sentryDSN: string | undefined = undefined
