import * as transportsModule from '@repo/lib/modules/web3/transports'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { ANVIL_NETWORKS, ChainIdWithFork, getTestRpcSetup } from '@repo/test/anvil/anvil-setup'
import { mainnetTest, polygonTest } from '@repo/test/anvil/testWagmiConfig'
import {
  connectWithDefaultUser,
  disconnectDefaultUser,
} from '@repo/test/utils/wagmi/wagmi-connections'
import { configure } from '@testing-library/react'
import { createPublicClient, http } from 'viem'

// Integration tests hit anvil proxies over network; CI runners need more time
configure({ asyncUtilTimeout: 30_000 })

/*
  Specific setup for integration tests (that it is not needed in unit tests)
*/
beforeAll(async () => {
  // By default all the integration tests use MAINNET
  // If not, they must explicitly call startFork(<networkName>)
  await connectWithDefaultUser()
})

afterAll(async () => {
  await disconnectDefaultUser()
})

/*
  Mocks getDefaultRpcUrl to return the test rpcUrl ('http://127.0.0.1:port/poolId')
  Keeps the rest of the module unmocked
*/
vi.mock('@repo/lib/modules/web3/transports', async importOriginal => {
  const originalModule = await importOriginal<typeof transportsModule>()
  return {
    ...originalModule,
    getRpcUrl: (chainId: number) => {
      // Fork chains route straight to their anvil proxy (ANVIL_NETWORKS is
      // keyed by chain id). Upstream read chainsByKey[chainId]!.id — a UI-chains
      // lookup that crashes when the app's supported networks no longer include
      // the fork chain (our app supports Base/Base Sepolia only).
      if (chainId in ANVIL_NETWORKS) {
        const { rpcUrl } = getTestRpcSetup(chainId as ChainIdWithFork)
        return rpcUrl
      }

      return originalModule.getRpcUrl(chainId)
    },
  }
})

/*
  Mocks getViemClient to use the test chain definitions,
  which use test rpcUrls ('http://127.0.0.1:port/poolId')
*/
vi.mock('@repo/lib/shared/services/viem/viem.client', () => {
  return {
    getViemClient: (chain: GqlChain) => {
      return createPublicClient({
        chain: chain === GqlChainValues.Mainnet ? mainnetTest : polygonTest,
        transport: http(),
      })
    },
  }
})
