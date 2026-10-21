import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// RPC proxy laws: the proxy is a thin, constrained relay — standard node
// methods only, bounded body, upstream statuses preserved.

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(resolve(HERE, 'rpc.ts'), 'utf8')
const SRC2 = readFileSync(resolve(HERE, '../rpc.ts'), 'utf8')

describe('rpc proxy laws', () => {
  it('relays standard node namespaces only (allowlist, not blocklist)', () => {
    expect(SRC).toContain("ALLOWED_METHOD_PREFIXES = ['eth_', 'net_', 'web3_']")
  })

  it('caps the request body size', () => {
    expect(SRC).toContain('MAX_BODY_BYTES')
    expect(SRC).toContain('status: 413')
  })

  it('rejects disallowed methods with 403', () => {
    expect(SRC).toContain("'Method not allowed'")
    expect(SRC).toContain('status: 403')
  })

  it('rejects malformed JSON with 400', () => {
    expect(SRC).toContain('status: 400')
  })

  it('preserves upstream statuses (no Response.json re-wrap)', () => {
    expect(SRC).toContain('Return the upstream Response directly')
  })

  it('never 500s on a missing optional DRPC key — falls back to the public CORS-verified RPC (app zero-error law)', () => {
    // Live defect 2026-10-21: /api/rpc/BASE returned 500 'NEXT_PRIVATE_DRPC_KEY
    // is missing' on production, silently dead-ending the initialize /
    // add-liquidity build calls — the only flows that read through the proxy.
    // The proxy must keep serving reads without an operator-funded key.
    expect(SRC).not.toContain("error: 'NEXT_PRIVATE_DRPC_KEY is missing'")
    expect(SRC).toContain('publicRpcByChain')
  })

  it('served-chains law — no upstream URL means reject, never forward an arbitrary chain', () => {
    expect(SRC).toContain('if (!upstreamUrl)')
  })

  it('public fallback covers exactly the served chains, CORS-verified URLs', () => {
    expect(SRC2).toContain('publicRpcByChain')
    expect(SRC2).toContain("'https://base.publicnode.com'")
    expect(SRC2).toContain("'https://sepolia.base.org'")
  })
})
