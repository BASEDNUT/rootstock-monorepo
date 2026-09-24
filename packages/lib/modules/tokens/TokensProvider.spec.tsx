import { vi, type Mock } from 'vitest'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { defaultTokenListMock } from './__mocks__/token.builders'
import { useTokensLogic } from './TokensProvider'
import type { ApiToken } from './token.types'

// Rootstock S100: unit tests never fire live RPC. The onchain pool-token
// fetch (sepolia.base.org reads for BASESEP pool tokens) is mocked here —
// default [] keeps the original API-only assertion intact.
vi.mock('./onchain-pool-tokens', () => ({
  fetchOnchainPoolTokens: vi.fn(),
}))

// Rootstock S100: the ETH/WETH BASESEP synthesis is also mocked so the
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

function testUseTokens() {
  const { result } = testHook(() => useTokensLogic())
  return result
}

test('fetches tokens', async () => {
  const result = testUseTokens()

  await waitFor(() => expect(result.current.tokens.length).toBeGreaterThan(0))

  expect(result.current.tokens).toEqual(defaultTokenListMock)
})

// Rootstock S100 merge law: API tokens + onchain-only synthesized tokens +
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
  } as ApiToken
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
