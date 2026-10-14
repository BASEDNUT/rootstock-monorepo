/**
 * Per-client fixed-window rate limiter for internal API routes.
 *
 * Origin checks alone do not stop scripted reuse of operator-funded
 * endpoints - a forger can send an allowed referer from any client. Every
 * keyed internal route also enforces a per-client budget; over-budget
 * requests get an honest 429 with a Retry-After header.
 *
 * Fixed-window counters are per-process (Next.js route handlers are
 * single-process per deployment); a multi-process deploy only splits
 * the budget per worker - it never removes the cap.
 */

export interface RateLimitConfig {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSec?: number
}

export const RATE_LIMITS = {
  rpcProxy: { limit: 600, windowMs: 60_000 },
  tenderly: { limit: 60, windowMs: 60_000 },
  walletCheck: { limit: 30, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitConfig>

interface WindowState {
  windowStart: number
  count: number
}

const windows = new Map<string, WindowState>()

export function resetRateLimiterForTests(): void {
  windows.clear()
}

type HeaderRequest = {
  headers: { get: (name: string) => string | null }
}

export function getClientKey(request: HeaderRequest): string {
  const fwd = request.headers.get('x-forwarded-for')

  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }

  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()

  return 'unknown'
}

export function checkRateLimit(
  bucket: string,
  clientKey: string,
  config: RateLimitConfig,
  now: number = Date.now()
): RateLimitResult {
  if (config.limit <= 0) {
    return { allowed: false, retryAfterSec: Math.ceil(config.windowMs / 1000) }
  }

  const key = bucket + ':' + clientKey
  const state = windows.get(key)

  if (!state || now >= state.windowStart + config.windowMs) {
    // lazy bound: drop windows from earlier periods as new ones open
    if (windows.size >= 1000) purgeStaleRateLimitWindows(now)
    windows.set(key, { windowStart: now, count: 1 })
    return { allowed: true }
  }

  if (state.count >= config.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((state.windowStart + config.windowMs - now) / 1000))
    return { allowed: false, retryAfterSec }
  }

  state.count += 1
  return { allowed: true }
}

export function purgeStaleRateLimitWindows(now: number = Date.now()): number {
  let purged = 0

  for (const [key, state] of windows) {
    if (now >= state.windowStart + 60_000) {
      windows.delete(key)
      purged += 1
    }
  }

  return purged
}

export function rateLimitedResponse(retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: 'Too many requests - slow down' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSec),
    },
  })
}
