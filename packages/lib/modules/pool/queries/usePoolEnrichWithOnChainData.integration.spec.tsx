import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { Pool } from '../pool.types'
import { usePoolEnrichWithOnChainData } from './usePoolEnrichWithOnChainData'
import { balWeth8020 } from '../__mocks__/pool-examples/flat'
import { getApiPoolMock } from '../__mocks__/api-mocks/api-mocks'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

/*
  Socketless prices + metadata (S114). The chains law (Base + Base Sepolia,
  both onchain-only) starves the live GetTokenPrices/GetTokens queries —
  priceFor() returns 0 and the enrichment assertions (sum(balance * price)
  > 0) fail.

  Previously served from an msw server living inside this spec. That
  violated the integration suite's own no-msw law
  (vitest.integration.base.ts strips setup-msw.ts): msw patches http and its
  teardown races live wagmi polling — a socket with active IO watchers is
  destroyed at worker teardown and the native uv__stream_destroy assertion
  kills the worker (ERR_IPC_CHANNEL_CLOSED). Proven by the 2026-10-08
  four-leg matrix: the msw-bearing specs crashed their workers under Node 22
  and 24, while the msw-free upstream spec ran clean under identical infra.
  Prices now arrive via a hoisted vi.mock factory — pure module
  substitution, zero sockets.
*/
vi.mock('@repo/lib/modules/tokens/TokensProvider', async importOriginal => {
  const actual = await importOriginal<typeof import('@repo/lib/modules/tokens/TokensProvider')>()
  const { allFakeGqlTokens } = await import('@repo/lib/test/data/all-gql-tokens.fake')
  return {
    ...actual,
    TokensProvider: ({ children }: { children?: ReactNode }) => children,
    useTokens: () => ({
      tokens: allFakeGqlTokens,
      prices: [],
      isLoadingTokens: false,
      isLoadingTokenPrices: false,
      getToken: () => undefined,
      getNativeAssetToken: () => undefined,
      getWrappedNativeAssetToken: () => undefined,
      // Flat 1: these assertions are sum(balance * price) > 0 — the real
      // query is starved by the chains law regardless.
      priceFor: () => 1,
      getTokensByChain: () => [],
      usdValueForToken: () => '0',
      usdValueForTokenAddress: () => '0',
      calcWeightForBalance: () => '0',
      calcTotalUsdValue: () => '0',
      startTokenPricePolling: () => {},
      stopTokenPricePolling: () => {},
      vebalBptToken: undefined,
    }),
  }
})

/*
  Cow AMM fixture (captured from the test API 2026-10-07): serves the V1 pool
  hermetically — the old fetchPoolMock hit the live API, whose TLS sockets
  tore down mid-write at teardown (unhandled ECANCELED failed the CI job even
  with every test passing).
*/
const cowAmmPoolFixture = {
  id: '0xf08d4dea369c456d26a3168ff0024b904f2d8b91',
  address: '0xf08d4dea369c456d26a3168ff0024b904f2d8b91',
  chain: 'MAINNET',
  type: 'COW_AMM',
  protocolVersion: 1,
  dynamicData: { totalLiquidity: '5562.92', totalShares: '119.625287948505436366' },
  poolTokens: [
    {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      balance: '2364.863769',
      hasNestedPool: false,
      nestedPool: null,
    },
    {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimals: 18,
      balance: '1.2430599188778695',
      hasNestedPool: false,
      nestedPool: null,
    },
  ],
}

function testPoolEnrichWithOnChainData(pool: Pool) {
  const { result } = testHook(() => usePoolEnrichWithOnChainData(pool))
  return result
}

test('enriches V3 pool with on-chain data', async () => {
  const pool = getApiPoolMock(balWeth8020)

  // delete values to ensure that onchain data is used
  pool.dynamicData.totalLiquidity = '0'
  pool.dynamicData.totalShares = '0'

  const result = testPoolEnrichWithOnChainData(pool)

  await waitFor(() => expect(result.current.isLoading).toBeFalsy())

  expect(Number(result.current.pool.dynamicData.totalLiquidity)).toBeGreaterThan(0) // Sum(api token balances  * mocked token prices (see defaultTokenPriceListMock))
  expect(Number(result.current.pool.dynamicData.totalShares)).toBeGreaterThan(0)
})

test('enriches V2 pool with on-chain data', async () => {
  const pool = getApiPoolMock(balWeth8020)

  // delete values to ensure that onchain data is used
  pool.dynamicData.totalLiquidity = '0'
  pool.dynamicData.totalShares = '0'

  const result = testPoolEnrichWithOnChainData(pool)

  await waitFor(() => expect(result.current.isLoading).toBeFalsy())

  expect(Number(result.current.pool.dynamicData.totalLiquidity)).toBeGreaterThan(0) // Sum(api token balances  * mocked token prices (see defaultTokenPriceListMock))
  expect(Number(result.current.pool.dynamicData.totalShares)).toBeGreaterThan(0)
})

test('enriches V1 Cow AMM pool with on-chain data', async () => {
  const pool = structuredClone(cowAmmPoolFixture) as unknown as Pool

  // delete values to ensure that onchain data is used
  pool.dynamicData.totalLiquidity = '0'
  pool.dynamicData.totalShares = '0'

  const result = testPoolEnrichWithOnChainData(pool)

  await waitFor(() => expect(result.current.isLoading).toBeFalsy())

  expect(Number(result.current.pool.dynamicData.totalLiquidity)).toBeGreaterThan(0) // Sum(api token balances  * mocked token prices (see defaultTokenPriceListMock))
  expect(Number(result.current.pool.dynamicData.totalShares)).toBeGreaterThan(0)
})
