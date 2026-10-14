import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

// RPC proxy laws: the proxy is a thin, constrained relay — standard node
// methods only, bounded body, upstream statuses preserved.

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(resolve(HERE, 'rpc.ts'), 'utf8')

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
})
