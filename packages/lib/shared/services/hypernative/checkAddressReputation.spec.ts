import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Auditor round-2 FIX-7 (A/F-05): wallet screening is fail-OPEN today — a
 * provider error silently returns isAuthorized:true. Policy must be
 * explicit and fail-CLOSED by default:
 * - Default (enforcing): provider error → HTTP 503 with error info (the
 *   caller fails closed; wallet flow does not proceed on unknown status).
 * - WALLET_SCREENING_MODE=advisory: provider error → HTTP 200 with an
 *   explicit degraded:true field (documented degraded mode — screening is
 *   unavailable, the response says so instead of lying 'authorized').
 */

beforeEach(() => {
  vi.resetModules()
  delete process.env.WALLET_SCREENING_MODE
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.WALLET_SCREENING_MODE
})

async function loadHandler() {
  const mod = await import('./checkAddressReputation')
  return mod.checkAddressReputation
}

const PARAMS = {
  address: '0x6bFB14bd210DeBFfb30285Ec53860c3334546a9e',
  hypernativeApiId: 'test-id',
  hypernativeApiSecret: 'test-secret',
}

describe('checkAddressReputation — fail-closed policy (auditor round-2 FIX-7)', () => {
  it(
    'enforcing (default): provider error → HTTP 503 with error info',
    { timeout: 30_000 },
    async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

      const handler = await loadHandler()
      const res = await handler(PARAMS)
      const body = (await res.json()) as Record<string, unknown>

      expect(res.status).toBe(503)
      expect(body.isAuthorized).toBe(false)
      expect(body.error).toBeTruthy()
    }
  )

  it('enforcing: provider non-ok response → HTTP 503', { timeout: 30_000 }, async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const handler = await loadHandler()
    const res = await handler(PARAMS)

    expect(res.status).toBe(503)
  })

  it(
    'advisory: provider error → HTTP 200 + explicit degraded:true',
    { timeout: 30_000 },
    async () => {
      process.env.WALLET_SCREENING_MODE = 'advisory'
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

      const handler = await loadHandler()
      const res = await handler(PARAMS)
      const body = (await res.json()) as Record<string, unknown>

      expect(res.status).toBe(200)
      expect(body.degraded).toBe(true)
      expect(body.error).toBeTruthy()
    }
  )

  it('advisory: provider non-ok response → 200 + degraded:true', { timeout: 30_000 }, async () => {
    process.env.WALLET_SCREENING_MODE = 'advisory'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    const handler = await loadHandler()
    const res = await handler(PARAMS)
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.degraded).toBe(true)
  })

  it(
    'provider success: Allow recommendation → isAuthorized:true (no degraded flag)',
    { timeout: 30_000 },
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ flags: [], address: PARAMS.address, recommendation: 'Allow' }],
          }),
        })
      )

      const handler = await loadHandler()
      const res = await handler(PARAMS)
      const body = (await res.json()) as Record<string, unknown>

      expect(res.status).toBe(200)
      expect(body.isAuthorized).toBe(true)
      expect(body.degraded).toBeUndefined()
    }
  )

  it(
    'provider success: Deny recommendation → isAuthorized:false',
    { timeout: 30_000 },
    async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [{ flags: ['OFAC'], address: PARAMS.address, recommendation: 'Deny' }],
          }),
        })
      )

      const handler = await loadHandler()
      const res = await handler(PARAMS)
      const body = (await res.json()) as Record<string, unknown>

      expect(res.status).toBe(200)
      expect(body.isAuthorized).toBe(false)
    }
  )
})
