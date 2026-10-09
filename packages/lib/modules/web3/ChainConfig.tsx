'use client'

import { Chain } from '@rainbow-me/rainbowkit'
import {
  arbitrum,
  avalanche,
  base,
  baseSepolia,
  fantom,
  gnosis,
  mainnet,
  optimism,
  polygon,
  sepolia,
  sonic,
  plasma,
  monad,
} from 'wagmi/chains'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { keyBy } from 'lodash'
import { getBaseUrl } from '@repo/lib/shared/utils/urls'
import { PROJECT_CONFIG } from '@repo/lib/config/getProjectConfig'
import { shouldUseAnvilFork } from '@repo/lib/config/app.config'
import { defaultAnvilForkRpcUrl } from '@repo/lib/test/utils/wagmi/fork.helpers'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { hyperEVM } from '@balancer/sdk'

/* If a request with the default rpc fails, it will fall back to the next one in the list.
  https://viem.sh/docs/clients/transports/fallback#fallback-transport
*/
export const rpcFallbacks: Partial<Record<GqlChain, string | undefined>> = {
  [GqlChainValues.Mainnet]: 'https://1rpc.io/eth',
  [GqlChainValues.Arbitrum]: 'https://1rpc.io/arb',
  [GqlChainValues.Base]: 'https://base.publicnode.com',
  [GqlChainValues.BaseSepolia]: 'https://sepolia.base.org',
  [GqlChainValues.Avalanche]: 'https://1rpc.io/avax/c',
  [GqlChainValues.Fantom]: 'https://1rpc.io/ftm',
  [GqlChainValues.Gnosis]: 'https://1rpc.io/gnosis',
  [GqlChainValues.Optimism]: 'https://1rpc.io/op',
  [GqlChainValues.Polygon]: 'https://1rpc.io/matic',
  [GqlChainValues.Sepolia]: 'https://sepolia.base.org',
  [GqlChainValues.Sonic]: 'https://1rpc.io/sonic',
  [GqlChainValues.Hyperevm]: 'https://1rpc.io/hyperliquid',
  [GqlChainValues.Plasma]: 'https://rpc.plasma.to',
  [GqlChainValues.Monad]: 'https://rpc.monad.xyz',
}

const baseUrl = getBaseUrl()

// S109 (Boss live E2E walk 2026-09-30): the IPFS export ships no API
// server — the /api/rpc proxy 404s on gateways (killed swap quotes
// live). Our chains route to public RPCs on the ship. CORS-verified
// live: base.publicnode.com -> 'access-control-allow-origin: *',
// sepolia.base.org -> echoes origin. 1rpc.io is CORS-BLOCKED from
// browsers (probed: no ACAO header) — replaced for our chains.
const isIpfsExport = process.env.NEXT_PUBLIC_IPFS_EXPORT === '1'

export const exportPublicRpcUrls: Partial<Record<GqlChain, string>> = {
  [GqlChainValues.Base]: 'https://base.publicnode.com',
  [GqlChainValues.BaseSepolia]: 'https://sepolia.base.org',
  [GqlChainValues.Sepolia]: 'https://sepolia.base.org',
}

const getPrivateRpcUrl = (chain: GqlChain) => {
  // Use anvil fork for E2E dev tests
  if (shouldUseAnvilFork) return defaultAnvilForkRpcUrl
  if (isIpfsExport) return exportPublicRpcUrls[chain]
  return `${baseUrl}/api/rpc/${chain}`
}

export const rpcOverrides: Partial<Record<GqlChain, string | undefined>> = {
  [GqlChainValues.Mainnet]: getPrivateRpcUrl(GqlChainValues.Mainnet),
  [GqlChainValues.Arbitrum]: getPrivateRpcUrl(GqlChainValues.Arbitrum),
  [GqlChainValues.Base]: getPrivateRpcUrl(GqlChainValues.Base),
  [GqlChainValues.Avalanche]: getPrivateRpcUrl(GqlChainValues.Avalanche),
  [GqlChainValues.Fantom]: getPrivateRpcUrl(GqlChainValues.Fantom),
  [GqlChainValues.Gnosis]: getPrivateRpcUrl(GqlChainValues.Gnosis),
  [GqlChainValues.Optimism]: getPrivateRpcUrl(GqlChainValues.Optimism),
  [GqlChainValues.Polygon]: getPrivateRpcUrl(GqlChainValues.Polygon),
  [GqlChainValues.Sepolia]: getPrivateRpcUrl(GqlChainValues.Sepolia),
  [GqlChainValues.Sonic]: getPrivateRpcUrl(GqlChainValues.Sonic),
  [GqlChainValues.Hyperevm]: getPrivateRpcUrl(GqlChainValues.Hyperevm),
  [GqlChainValues.Plasma]: getPrivateRpcUrl(GqlChainValues.Plasma),
  [GqlChainValues.Monad]: getPrivateRpcUrl(GqlChainValues.Monad),
}

const gqlChainToWagmiChainMap: Partial<Record<GqlChain, Chain>> = {
  [GqlChainValues.Mainnet]: { iconUrl: '/images/chains/MAINNET.svg', ...mainnet },
  [GqlChainValues.Arbitrum]: { iconUrl: '/images/chains/ARBITRUM.svg', ...arbitrum },
  [GqlChainValues.Base]: { iconUrl: '/images/chains/BASE.svg', ...base },
  [GqlChainValues.BaseSepolia]: { iconUrl: '/images/chains/BASESEPOLIA.svg', ...baseSepolia },
  [GqlChainValues.Avalanche]: { iconUrl: '/images/chains/AVALANCHE.svg', ...avalanche },
  [GqlChainValues.Fantom]: { iconUrl: '/images/chains/FANTOM.svg', ...fantom },
  [GqlChainValues.Gnosis]: { iconUrl: '/images/chains/GNOSIS.svg', ...gnosis },
  [GqlChainValues.Optimism]: { iconUrl: '/images/chains/OPTIMISM.svg', ...optimism },
  [GqlChainValues.Polygon]: { iconUrl: '/images/chains/POLYGON.svg', ...polygon },
  [GqlChainValues.Sepolia]: { iconUrl: '/images/chains/SEPOLIA.svg', ...sepolia },
  [GqlChainValues.Sonic]: { iconUrl: '/images/chains/SONIC.svg', ...sonic },
  [GqlChainValues.Hyperevm]: { iconUrl: '/images/chains/HYPEREVM.svg', ...(hyperEVM as Chain) }, // TODO: fix type when rainbowkit is updated
  [GqlChainValues.Plasma]: { iconUrl: '/images/chains/PLASMA.svg', ...plasma },
  [GqlChainValues.Monad]: { iconUrl: '/images/chains/MONAD.svg', ...monad },
} as const

export const supportedNetworks = PROJECT_CONFIG.supportedNetworks
const chainToFilter = PROJECT_CONFIG.defaultNetwork
const customChain = gqlChainToWagmiChainMap[chainToFilter]
if (!customChain) throw new Error(`Unable to find default chain ${chainToFilter}`)

/*
  S114: the dev-E2E harness impersonates against the ETHEREUM-mainnet anvil fork
  (CI forks eth.drpc.org; dev specs use ethereum pool mocks). The shipped chain
  law stays Base + Base Sepolia (S110), but wagmi rejects the fork connect with
  ChainNotConfiguredError when the fork chain is missing from this config — every
  impersonating dev-E2E test silently dies waiting for the wallet Avatar. Gate:
  NEXT_PUBLIC_E2E_DEV only; transports.ts builds per-chain fork transports under
  the same gate, so the appended chain routes to 127.0.0.1:8545 automatically.
  Shipped builds never set the var and are unchanged.
*/
const ethereumForkChain = gqlChainToWagmiChainMap[GqlChainValues.Mainnet]

const assembledChains: Chain[] = [
  customChain,
  ...(supportedNetworks
    .filter(chain => chain !== chainToFilter)
    .map(gqlChain => gqlChainToWagmiChainMap[gqlChain]) as Chain[]),
]

if (
  shouldUseAnvilFork &&
  ethereumForkChain &&
  !assembledChains.some(c => c.id === ethereumForkChain.id)
) {
  assembledChains.push(ethereumForkChain)
}

export const chains: readonly [Chain, ...Chain[]] = assembledChains as [Chain, ...Chain[]]

export const chainsByKey = keyBy(chains, 'id')

export function getDefaultRpcUrl(chainId: number) {
  return chainsByKey[chainId]!.rpcUrls.default.http[0]!
}
