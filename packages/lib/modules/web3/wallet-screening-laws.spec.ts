import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// Wallet-screening laws: the screening path must never silently authorize.
// The static export ships no API server, so the client check is structurally
// skipped there (honest absence, not a fake pass). Server deployments fail
// closed: unconfigured screening, provider errors, and unreachable
// infrastructure never authorize a wallet.

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../..')
const PROVIDER = resolve(ROOT, 'packages/lib/modules/web3/UserAccountProvider.tsx')
const ROUTE = resolve(ROOT, 'apps/frontend-v3/app/api/wallet-check/[address]/route.ts')

const providerSrc = readFileSync(PROVIDER, 'utf8')
const routeSrc = existsSync(ROUTE) ? readFileSync(ROUTE, 'utf8') : ''

describe('wallet-screening laws', () => {
  it('client skips the check outside production deploys (static export / dev / test)', () => {
    const skipAt = providerSrc.indexOf(
      "if (isIpfsExportMode() || config.appEnv !== 'prod') return true"
    )

    const fetchAt = providerSrc.indexOf('fetch(`/api/wallet-check/')
    expect(skipAt).toBeGreaterThan(-1)
    expect(fetchAt).toBeGreaterThan(skipAt)
  })

  it('client never fail-opens on screening errors (server deployments)', () => {
    const fnAt = providerSrc.indexOf('async function isAuthorizedAddress')
    const catchAt = providerSrc.indexOf('} catch (err) {', fnAt)
    const failClosedAt = providerSrc.indexOf('return false', catchAt)
    expect(fnAt).toBeGreaterThan(-1)
    expect(catchAt).toBeGreaterThan(fnAt)
    expect(failClosedAt).toBeGreaterThan(catchAt)
    const between = providerSrc.slice(catchAt, providerSrc.indexOf('}', failClosedAt))
    expect(between).not.toContain('return true')
  })

  it('client parses the authorization flag strictly', () => {
    expect(providerSrc).toContain('data?.isAuthorized === true')
  })

  it('route validates the address before any provider call', () => {
    expect(routeSrc).toContain('isAddress')
    expect(routeSrc).toContain('status: 400')
  })

  it('unconfigured screening never authorizes (fail-closed default)', () => {
    expect(routeSrc).toContain('status: 503')
    expect(routeSrc).not.toContain('return NextResponse.json({ isAuthorized: true })')
  })

  it('advisory mode is explicit (degraded flag, never a silent pass)', () => {
    expect(routeSrc).toContain('WALLET_SCREENING_MODE')
    expect(routeSrc).toContain('degraded: true')
  })
})
