import { Address, createPublicClient, createTestClient, http } from 'viem'
import { SetBalanceMutation } from '../../anvil/useSetErc20Balance'
import { TokenBalance, TokenBalancesByChain } from './fork-options'
import { createConfig } from 'wagmi'
import { mainnet, sonic } from 'viem/chains'
import { drpcUrlByChainId } from '@repo/lib/shared/utils/rpc'
import { isBeets } from '@repo/lib/config/getProjectConfig'

/*
  E2E dev tests use an anvil fork to impersonate and test with default anvil accounts
  This is a helper file to provide related constants and helpers
*/

import {
  defaultAnvilAccount,
  defaultAnvilForkRpcUrl,
} from '@repo/lib/modules/web3/impersonation/fork-constants'

export { defaultAnvilAccount, defaultAnvilForkRpcUrl }
export {
  setImpersonatedAddressLS,
  getSavedImpersonatedAddressLS,
  clearImpersonatedAddressLS,
} from '@repo/lib/modules/web3/impersonation/impersonation-storage'

const chain = {
  ...(isBeets ? sonic : mainnet),
  rpcUrls: {
    default: {
      http: [defaultAnvilForkRpcUrl],
    },
  },
}

export const forkClient = createTestClient({
  chain,
  mode: 'anvil',
  transport: http(defaultAnvilForkRpcUrl),
})

// Only used to get the running fork chainId
export const publicForkClient = createPublicClient({
  transport: http(defaultAnvilForkRpcUrl),
})

type WagmiConfig = ReturnType<typeof createConfig>

type SetBalancesParams = {
  impersonatedAddress: Address
  wagmiConfig: WagmiConfig
  setBalance: SetBalanceMutation
  tokenBalances: TokenBalancesByChain
  chainId?: number
}

export async function setTokenBalances({
  setBalance,
  tokenBalances,
  chainId,
  impersonatedAddress,
  wagmiConfig,
}: SetBalancesParams) {
  async function setChainBalances(tokenBalances: TokenBalance[], chainId: number) {
    for (const tokenBalance of tokenBalances) {
      await setBalance.mutateAsync({
        balance: tokenBalance,
        wagmiConfig,
        address: impersonatedAddress,
        chainId,
      })
    }
  }

  if (chainId) {
    return setChainBalances(tokenBalances[chainId] || [], chainId)
  }

  // Iterate over all chains
  for (const chainId in tokenBalances) {
    await setChainBalances(tokenBalances[chainId] || [], Number(chainId))
  }
}

export function resetFork(chainId: number = mainnet.id) {
  const privateKey = process.env['NEXT_PRIVATE_DRPC_KEY']

  // Keyless fallback: public archive RPC serving the pinned fork block.
  const jsonRpcUrl = privateKey ? drpcUrlByChainId(chainId, privateKey) : 'https://eth.drpc.org'

  return forkClient.reset({
    jsonRpcUrl,
  })
}

export { impersonatedAddressStorageKey } from '@repo/lib/modules/web3/impersonation/fork-constants'
