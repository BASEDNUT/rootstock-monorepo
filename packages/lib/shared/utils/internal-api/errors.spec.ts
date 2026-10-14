import { describe, expect, it, vi } from 'vitest'
import { isAllowedOrigin } from './errors'

/**
 * Auditor round-2 FIX-6 (A/F-05 partial): referer.startsWith(origin) is
 * prefix-spoofable — https://evil-allowedorigin.com passes an allowlist
 * containing https://allowedorigin.com. Strict equality: parse the referer
 * URL and compare url.origin === allowedOrigin exactly (both http/https
 * forms pass only if the config lists them). Missing/invalid referer →
 * false. This stays a supplementary control (not the primary CSRF defense).
 */

type Req = { headers: { get: (name: string) => string | null } }

function requestWithReferer(referer: string | null): Req {
  return { headers: { get: vi.fn(() => referer) } } as unknown as Req
}

const ALLOWED = ['https://rootstock.example', 'http://localhost:3000']

describe('isAllowedOrigin — strict origin equality (auditor round-2 FIX-6)', () => {
  it('exact https origin matches', () => {
    expect(
      isAllowedOrigin(requestWithReferer('https://rootstock.example/swap') as never, ALLOWED)
    ).toBe(true)
  })

  it('exact http origin matches (listed form)', () => {
    expect(
      isAllowedOrigin(requestWithReferer('http://localhost:3000/pools') as never, ALLOWED)
    ).toBe(true)
  })

  it('prefix-spoof referer is REJECTED (evil-allowedorigin.com)', () => {
    expect(
      isAllowedOrigin(requestWithReferer('https://evil-rootstock.example/attack') as never, ALLOWED)
    ).toBe(false)
  })

  it('prefix-spoof with dotless subdomain is REJECTED', () => {
    expect(
      isAllowedOrigin(
        requestWithReferer('https://rootstock.example.evil.com/attack') as never,
        ALLOWED
      )
    ).toBe(false)
  })

  it('unlisted origin is REJECTED even when well-formed', () => {
    expect(
      isAllowedOrigin(requestWithReferer('https://other.example/page') as never, ALLOWED)
    ).toBe(false)
  })

  it('missing referer → false', () => {
    expect(isAllowedOrigin(requestWithReferer(null) as never, ALLOWED)).toBe(false)
  })

  it('empty referer → false', () => {
    expect(isAllowedOrigin(requestWithReferer('') as never, ALLOWED)).toBe(false)
  })

  it('malformed referer URL → false (never throws)', () => {
    expect(isAllowedOrigin(requestWithReferer('not-a-url') as never, ALLOWED)).toBe(false)
    expect(isAllowedOrigin(requestWithReferer('http://') as never, ALLOWED)).toBe(false)
  })

  it('path/query/hash never affect the origin comparison', () => {
    expect(
      isAllowedOrigin(requestWithReferer('https://rootstock.example/a/b?c=d#e') as never, ALLOWED)
    ).toBe(true)
  })

  it('port must match exactly (listed 3000, referer 3001 → false)', () => {
    expect(
      isAllowedOrigin(requestWithReferer('http://localhost:3001/pools') as never, ALLOWED)
    ).toBe(false)
  })
})
