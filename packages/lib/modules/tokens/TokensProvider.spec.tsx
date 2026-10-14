import { vi, type Mock } from 'vitest'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { defaultTokenListMock } from './__mocks__/token.builders'
import { useTokensLogic } from './TokensProvider'
import type { ApiToken } from './token.types'

// Rootstock : unit tests never fire live RPC. The onchain pool-token
// fetch (sepolia.base.org reads for BASESEP pool tokens) is mocked here —
// default [] keeps the original API-only assertion intact.
// FIX-7: the factory-token discovery (per-chain) is mocked too — the
// provider now queries BOTH chains and a live BASE query would fire real
// RPC from the unit suite (base.publicnode.com is not msw-stubbed).
vi.mock('./onchain-pool-tokens', () => ({
  fetchOnchainPoolTokens: vi.fn(),
}))

vi.mock('../primitives/onchain-factory-tokens', () => ({
  fetchOnchainFactoryTokens: vi.fn(),
}))

// Rootstock : the ETH/WETH BASESEP synthesis is also mocked so the
// original 'fetches tokens' equality assertion stays a pure API test.
vi.mock('./onchain-tokens', () => ({
  getOnchainOnlyTokens: vi.fn(),
}))

import { fetchOnchainPoolTokens } from './onchain-pool-tokens'
import { getOnchainOnlyTokens } from './onchain-tokens'

beforeEach(() => {
  ;(fetchOnchainPoolTokens as unknown as Mock).mockResolvedValue([])

  ;(getOnchainOnlyTokens as unknown as Mock).mockReturnValue([])
})

import { fetchOnchainFactoryTokens } from '../primitives/onchain-factory-tokens'

beforeEach(() => {
  ;(fetchOnchainFactoryTokens as unknown as Mock).mockResolvedValue([])
})

function testUseTokens() {
  const { result } = testHook(() => useTokensLogic())
  return result
}

test('fetches tokens', async () => {
  const result = testUseTokens()

  await waitFor(() => expect(result.current.tokens.length).toBeGreaterThan(0))

  expect(result.current.tokens).toEqual(defaultTokenListMock)
})

// Rootstock merge law: API tokens + onchain-only synthesized tokens +
// onchain-discovered pool tokens (BASESEP) all appear in the token list.
test('merges onchain pool tokens with API tokens', async () => {
  const onchainToken = {
    chain: 'BASESEP',
    address: '0x8c6487b86A73554431d514371184916B0B61B876',
    symbol: 'BAL',
    name: 'Balancer Governance Token',
    decimals: 18,
    logoURI: '',
    coingeckoId: '',
    priority: 0,
    excludedFromWallet: false,
    nativeAsset: false,
  } as unknown as ApiToken

  ;(fetchOnchainPoolTokens as unknown as Mock).mockResolvedValue([onchainToken])

  const result = testUseTokens()

  await waitFor(() => expect(result.current.tokens.length).toBeGreaterThan(0))

  const addresses = result.current.tokens.map(t => `${t.chain}:${t.address}`)

  // every API mock token present
  for (const t of defaultTokenListMock) {
    expect(addresses).toContain(`${t.chain}:${t.address}`)
  }

  // onchain BASESEP token present
  expect(addresses).toContain('BASESEP:0x8c6487b86A73554431d514371184916B0B61B876')
})
