import { vi, type Mock } from 'vitest'
import { waitFor } from '@testing-library/react'
import { PoolList as PoolListType } from '@repo/lib/modules/pool/pool.types'
import { defaultPoolListMock, mockPoolList } from '@repo/lib/test/msw/handlers/PoolList.handlers'
import { aGqlPoolMinimalMock } from '@repo/lib/test/msw/builders/gqlPoolMinimal.builders'
import { testHook } from '@repo/lib/test/utils/custom-renderers'
import { usePoolListLogic } from './PoolListProvider'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { PROJECT_CONFIG, isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import type { OnchainPoolListItem } from '../onchain-pool-discovery'

// Mock onchain discovery — unit tests never hit live RPC (onchain-only law
// applies to production; tests mock the fetch layer)
vi.mock('../useOnchainPoolDiscovery', () => ({
  useOnchainPoolDiscovery: vi.fn(),
}))

import { useOnchainPoolDiscovery } from '../useOnchainPoolDiscovery'

// Default mock so non-BASESEP tests (hook always runs) get a safe shape
beforeEach(() => {
  ;(useOnchainPoolDiscovery as unknown as Mock).mockReturnValue({ data: [] })
})

const mockOnchainPools: OnchainPoolListItem[] = [
  {
    id: '0xabc0000000000000000000000000000000000001',
    address: '0xabc0000000000000000000000000000000000001',
    chain: GqlChainValues.BaseSepolia,
    type: 'WEIGHTED' as never,
    protocolVersion: 3,
    symbol: 'MOCK-80/20',
    name: 'Mock Weighted Pool',
    factory: '0x277d7dde3c6762c31cfb438c9331376fe8887a7c',
    createTime: 47_000_000,
    poolTokens: [
      { address: '0x4200000000000000000000000000000000000006' },
      { address: '0x8c6487b86a73554431d514371184916b0b61b876' },
    ],
    dynamicData: {
      totalLiquidity: '0',
      volume24h: '0',
      aprItems: [],
      fees24h: '0',
    },
  },
]

// Repo-native seeding: withNuqsTestingAdapter({ searchParams })
const withBaseSepNetworks = withNuqsTestingAdapter({ searchParams: '?networks=BASESEP' })

async function renderUsePoolsList() {
  const { result, waitForLoadedUseQuery } = testHook(() => usePoolListLogic(), {
    wrapper: withNuqsTestingAdapter(),
  })

  await waitForLoadedUseQuery(result)
  return result
}

test('Returns pool list', async () => {
  const result = await renderUsePoolsList()

  expect(result.current.pools).toEqual(defaultPoolListMock)
})

test('Returns pool list with a custom mocked GQL pool', async () => {
  const mockedList: PoolListType = [aGqlPoolMinimalMock({ name: 'FOO BAL' })]

  mockPoolList(mockedList)

  const result = await renderUsePoolsList()

  expect(result.current.pools[0]!.name).toEqual('FOO BAL')
})

// ─── Rootstock S100: onchain-only network (BASESEP) pool list law ───
//
// Law: when the user filters to an onchain-only network (Base Sepolia), the
// pool list MUST come from onchain discovery — never the remote API. The API
// never knows our pools, so the list must not be empty and must not show the
// API's global count.

test('BASESEP filter yields onchain pools, not API pools; count is onchain count', async () => {
  ;(useOnchainPoolDiscovery as unknown as Mock).mockReturnValue({
    data: mockOnchainPools,
  })

  const config = PROJECT_CONFIG
  expect((config.onchainOnlyNetworks || []).length).toBeGreaterThan(0)

  const { result } = testHook(() => usePoolListLogic(), {
    wrapper: withBaseSepNetworks,
  })

  await waitFor(() => result.current.pools.length > 0)

  // every pool comes from onchain discovery (BASESEP), none from the API
  for (const pool of result.current.pools) {
    expect(isOnchainOnlyNetwork(pool.chain)).toBe(true)
  }

  // count reflects onchain pools — NOT the API's global pool count
  expect(result.current.count).toBe(result.current.pools.length)
})

test('onchain pool list items carry dynamicData so table rows render', async () => {
  ;(useOnchainPoolDiscovery as unknown as Mock).mockReturnValue({
    data: mockOnchainPools,
  })

  const { result } = testHook(() => usePoolListLogic(), {
    wrapper: withBaseSepNetworks,
  })

  await waitFor(() => result.current.pools.length > 0)

  for (const pool of result.current.pools) {
    expect(pool.dynamicData).toBeDefined()
    expect(typeof pool.dynamicData.totalLiquidity).toBe('string')
  }
})
