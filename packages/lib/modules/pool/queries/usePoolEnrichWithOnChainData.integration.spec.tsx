import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { waitFor } from '@testing-library/react'
import { Pool } from '../pool.types'
import { fetchPoolMock, poolEnrichQuery } from '../__mocks__/fetchPoolMock'
import { usePoolEnrichWithOnChainData } from './usePoolEnrichWithOnChainData'
import { balWeth8020 } from '../__mocks__/pool-examples/flat'
import { getApiPoolMock } from '../__mocks__/api-mocks/api-mocks'

import { graphql, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { aTokenPriceMock } from '../../tokens/__mocks__/token.builders'

/*
  Rootstock chains law: supportedNetworks = Base + Base Sepolia, both
  onchain-only, so toApiNetworks() = [] and the real GetTokenPrices query is
  intentionally starved. These tests assert enrichment math over upstream
  mainnet pools and need prices — served here from a dedicated msw server.
  bypass lets everything unmocked (anvil fork RPC, fetchPoolMock fixtures)
  pass through untouched.
*/
const priceOf = (address: string) => aTokenPriceMock({ address, chain: GqlChainValues.Mainnet })

/*
  Inline graphql handler (operation name 'GetTokenPrices' as sent by the app):
  importing the shared msw handler module pulls the circular
  utils -> server -> default-handlers -> handlers chain, whose module-init
  order TDZ-crashes under the integration SSR transform. Built inline instead.
*/
const tokenPricesServer = setupServer(
  graphql.query('GetTokenPrices', () =>
    HttpResponse.json({
      data: {
        tokenPrices: [
          priceOf('0xba100000625a3754423978a60c9317c58a424e3d'), // BAL
          priceOf('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'), // WETH
          priceOf('0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0'), // wstETH (Cow AMM pool)
          priceOf('0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'), // AAVE (Cow AMM pool)
        ],
      },
    })
  )
)

beforeAll(() => tokenPricesServer.listen({ onUnhandledRequest: 'bypass' }))
afterAll(() => tokenPricesServer.close())

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
  const cowPoolId = '0xf08d4dea369c456d26a3168ff0024b904f2d8b91'

  const pool = await fetchPoolMock({
    poolId: cowPoolId,
    chain: GqlChainValues.Mainnet,
    query: poolEnrichQuery,
  })

  // delete values to ensure that onchain data is used
  pool.dynamicData.totalLiquidity = '0'
  pool.dynamicData.totalShares = '0'

  const result = testPoolEnrichWithOnChainData(pool)

  await waitFor(() => expect(result.current.isLoading).toBeFalsy())

  expect(Number(result.current.pool.dynamicData.totalLiquidity)).toBeGreaterThan(0) // Sum(api token balances  * mocked token prices (see defaultTokenPriceListMock))
  expect(Number(result.current.pool.dynamicData.totalShares)).toBeGreaterThan(0)
})
