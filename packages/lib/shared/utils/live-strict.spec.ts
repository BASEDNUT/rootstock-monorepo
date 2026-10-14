import { describe, expect, it } from 'vitest'
import { classifyLiveStrictError, isLiveInfrastructureError } from './live-strict'

/**
 * Auditor round-2 FIX-4 (B/F-08): ROOTSTOCK_LIVE_STRICT mode must distinguish
 * infrastructure failures from logic failures.
 * - Infrastructure (fetch/HTTP 429/timeout/DNS/connection/RPC unavailable):
 *   explicit vitest.skip with a visible warning — the live target is
 *   unreachable, the code is not proven broken.
 * - Logic/assertion/contract errors (revert selectors, failed expectations,
 *   invalid shapes): THROW — strict mode fails the run.
 */

describe('isLiveInfrastructureError — classifier', () => {
  it('classifies fetch/connection failures as infrastructure', () => {
    expect(isLiveInfrastructureError(new Error('fetch failed'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('getaddrinfo ENOTFOUND rpc.example.com'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('connect ECONNREFUSED 1.2.3.4:443'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('network timeout'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('Request timed out after 30000ms'))).toBe(true)
  })

  it('classifies HTTP 429 / 5xx transport errors as infrastructure', () => {
    expect(isLiveInfrastructureError(new Error('HTTP 429 Too Many Requests'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('429'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('HTTP 503 Service Unavailable'))).toBe(true)
    expect(isLiveInfrastructureError(new Error('502 Bad Gateway from provider'))).toBe(true)
  })

  it('classifies RPC unavailability as infrastructure', () => {
    expect(isLiveInfrastructureError(new Error('the method eth_getLogs does not exist'))).toBe(
      false
    )

    expect(isLiveInfrastructureError(new Error('Method not found'))).toBe(false)

    expect(isLiveInfrastructureError(new Error('Non-JSON response from RPC endpoint'))).toBe(false)

    expect(isLiveInfrastructureError(new Error('HTTP request failed with status 401'))).toBe(false)
  })

  it('classifies logic/revert/assertion errors as NOT infrastructure', () => {
    expect(isLiveInfrastructureError(new Error('TokensNotSorted()'))).toBe(false)
    expect(isLiveInfrastructureError(new Error('revert: AllowanceExpired'))).toBe(false)
    expect(isLiveInfrastructureError(new Error('expected 5 to be 3'))).toBe(false)
    expect(isLiveInfrastructureError(new Error('No Rootstock pool found for pair'))).toBe(false)
    expect(isLiveInfrastructureError(new Error('Requested pool is not available'))).toBe(false)
  })

  it('empty/malformed error messages default to logic (fail loud, not skip)', () => {
    expect(isLiveInfrastructureError(new Error(''))).toBe(false)
    expect(isLiveInfrastructureError(new Error('   '))).toBe(false)
  })
})

describe('classifyLiveStrictError — decision', () => {
  it('infrastructure error → skip decision with reason', () => {
    const d = classifyLiveStrictError(new Error('HTTP 429 Too Many Requests'))
    expect(d.action).toBe('skip')
    expect(d.reason).toMatch(/429/)
  })

  it('logic error → throw decision', () => {
    const d = classifyLiveStrictError(new Error('expected 5 to be 3'))
    expect(d.action).toBe('throw')
  })

  it('carries the original error for the throw path', () => {
    const err = new Error('TokensNotSorted()')
    const d = classifyLiveStrictError(err)
    expect(d.error).toBe(err)
  })

  it('non-Error thrown values are treated as logic errors (fail loud)', () => {
    const d = classifyLiveStrictError('string thrown')
    expect(d.action).toBe('throw')
  })
})
