import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { isAllowedOrigin } from './errors'

// Internal API laws: operator-funded routes (paid RPC relay, Tenderly
// simulations, wallet screening) enforce origin checks AND per-client
// rate limits. The wallet-check route runs with a plain Request - the
// origin check must accept it structurally.

const HERE = dirname(fileURLToPath(import.meta.url))
const MONO = resolve(HERE, '../../../../..')
const APP = resolve(MONO, 'apps/frontend-v3')

const rpcRoute = readFileSync(resolve(APP, 'app/api/rpc/[chain]/route.ts'), 'utf8')
const tenderlyRoute = readFileSync(resolve(APP, 'app/api/tenderly/gas-estimate/route.ts'), 'utf8')

const walletCheckRoute = readFileSync(
  resolve(APP, 'app/api/wallet-check/[address]/route.ts'),
  'utf8'
)

describe('internal API route laws', () => {
  it('rpc proxy enforces a per-client rate limit after the origin check', () => {
    expect(rpcRoute).toContain('isAllowedOrigin')
    expect(rpcRoute).toContain('checkRateLimit')
    expect(rpcRoute).toContain('RATE_LIMITS.rpcProxy')
    expect(rpcRoute).toContain('rateLimitedResponse')
  })

  it('tenderly gas estimate enforces a per-client rate limit', () => {
    expect(tenderlyRoute).toContain('isAllowedOrigin')
    expect(tenderlyRoute).toContain('checkRateLimit')
    expect(tenderlyRoute).toContain('RATE_LIMITS.tenderly')
  })

  it('wallet screening enforces origin + rate limit (it carries operator credentials)', () => {
    expect(walletCheckRoute).toContain('isAllowedOrigin')
    expect(walletCheckRoute).toContain('checkRateLimit')
    expect(walletCheckRoute).toContain('RATE_LIMITS.walletCheck')
  })
})

describe('isAllowedOrigin accepts plain Request objects (structural)', () => {
  it('matches an allowed referer origin with exact-equality semantics', () => {
    const request = {
      headers: {
        get: (name: string) => (name === 'referer' ? 'https://app.example/page' : null),
      },
    }

    expect(isAllowedOrigin(request, ['https://app.example'])).toBe(true)
    expect(isAllowedOrigin(request, ['https://not-example'])).toBe(false)
  })

  it('rejects missing or malformed referers', () => {
    expect(isAllowedOrigin({ headers: { get: () => null } }, ['https://app.example'])).toBe(false)

    expect(isAllowedOrigin({ headers: { get: () => 'not a url' } }, ['https://app.example'])).toBe(
      false
    )
  })
})
