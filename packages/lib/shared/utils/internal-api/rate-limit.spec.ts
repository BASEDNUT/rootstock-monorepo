import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientKey,
  purgeStaleRateLimitWindows,
  rateLimitedResponse,
  resetRateLimiterForTests,
} from './rate-limit'

// Rate-limit laws for internal API routes: origin checks alone do not
// protect operator-funded endpoints from scripted reuse — every keyed
// route also enforces a per-client budget, and over-budget requests get
// an honest 429 with a Retry-After header.

beforeEach(() => {
  resetRateLimiterForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('checkRateLimit (fixed window)', () => {
  it('allows up to the limit and blocks the next request with a retry hint', () => {
    const cfg = { limit: 3, windowMs: 60_000 }
    const now = 1_000_000

    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit('test', 'client-a', cfg, now)
      expect(r.allowed).toBe(true)
    }

    const blocked = checkRateLimit('test', 'client-a', cfg, now)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('the window rolls over - a new window resets the budget', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const cfg = { limit: 2, windowMs: 60_000 }

    expect(checkRateLimit('t', 'c', cfg).allowed).toBe(true)
    expect(checkRateLimit('t', 'c', cfg).allowed).toBe(true)
    expect(checkRateLimit('t', 'c', cfg).allowed).toBe(false)

    vi.setSystemTime(1_000_000 + 60_000)
    expect(checkRateLimit('t', 'c', cfg).allowed).toBe(true)
  })

  it('buckets and clients are independent', () => {
    const cfg = { limit: 1, windowMs: 60_000 }
    const now = 1_000_000

    expect(checkRateLimit('bucket-a', 'c1', cfg, now).allowed).toBe(true)
    expect(checkRateLimit('bucket-a', 'c1', cfg, now).allowed).toBe(false)
    expect(checkRateLimit('bucket-a', 'c2', cfg, now).allowed).toBe(true)
    expect(checkRateLimit('bucket-b', 'c1', cfg, now).allowed).toBe(true)
  })

  it('a zero limit never allows', () => {
    expect(checkRateLimit('t', 'c', { limit: 0, windowMs: 60_000 }, 1).allowed).toBe(false)
  })
})

describe('purgeStaleRateLimitWindows', () => {
  it('drops windows from earlier periods and keeps the current one', () => {
    const cfg = { limit: 5, windowMs: 60_000 }
    const now = 120_000

    checkRateLimit('t', 'old', cfg, now - 120_000) // two windows ago
    checkRateLimit('t', 'current', cfg, now)

    expect(purgeStaleRateLimitWindows(now)).toBe(1)
    expect(checkRateLimit('t', 'current', cfg, now).allowed).toBe(true)
  })
})

describe('getClientKey', () => {
  const req = (headers: Record<string, string>) => ({
    headers: { get: (name: string) => headers[name] ?? null },
  })

  it('uses the first forwarded-for hop', () => {
    expect(getClientKey(req({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to x-real-ip, then unknown', () => {
    expect(getClientKey(req({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9')
    expect(getClientKey(req({}))).toBe('unknown')
  })
})

describe('rateLimitedResponse', () => {
  it('returns 429 with a Retry-After header', async () => {
    const res = rateLimitedResponse(42)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBeDefined()
  })
})

describe('RATE_LIMITS defaults', () => {
  it('carries per-route budgets for every keyed internal route', () => {
    expect(RATE_LIMITS.rpcProxy.limit).toBeGreaterThan(0)
    expect(RATE_LIMITS.tenderly.limit).toBeGreaterThan(0)
    expect(RATE_LIMITS.walletCheck.limit).toBeGreaterThan(0)
  })
})
