import type { GqlChain } from '../services/api/generated/graphql'
import { GqlChainValues } from '../services/api/graphql-enums'
import { ChainId } from '@balancer/sdk'

const chainToDrpcName: Partial<Record<GqlChain, string | undefined>> = {
  [GqlChainValues.Mainnet]: 'ethereum',
  [GqlChainValues.Arbitrum]: 'arbitrum',
  [GqlChainValues.Optimism]: 'optimism',
  [GqlChainValues.Base]: 'base',
  [GqlChainValues.BaseSepolia]: 'base-sepolia',
  [GqlChainValues.Polygon]: 'polygon',
  [GqlChainValues.Avalanche]: 'avalanche',
  [GqlChainValues.Fantom]: 'fantom',
  [GqlChainValues.Sepolia]: 'sepolia',
  [GqlChainValues.Gnosis]: 'gnosis',
  [GqlChainValues.Sonic]: 'sonic',
  [GqlChainValues.Hyperevm]: 'hyperliquid',
  [GqlChainValues.Plasma]: 'plasma',
  [GqlChainValues.Monad]: 'monad',
}

const chainIdToDrpcName: Partial<Record<number, string | undefined>> = {
  [ChainId.MAINNET]: 'ethereum',
  [ChainId.ARBITRUM_ONE]: 'arbitrum',
  [ChainId.OPTIMISM]: 'optimism',
  [ChainId.BASE]: 'base',
  [ChainId.POLYGON]: 'polygon',
  [ChainId.AVALANCHE]: 'avalanche',
  [ChainId.FANTOM]: 'fantom',
  [ChainId.SEPOLIA]: 'sepolia',
  [ChainId.GNOSIS_CHAIN]: 'gnosis',
  [ChainId.SONIC]: 'sonic',
  [ChainId.HYPEREVM]: 'hyperliquid',
  [ChainId.PLASMA]: 'plasma',
  [ChainId.MONAD]: 'monad',
}

/**
 * Public CORS-verified RPCs for the chains this app serves. Used by the
 * /api/rpc proxy when no operator-funded DRPC key is configured — the
 * app's own read flows (initialize / add-liquidity build calls) must
 * never hard-fail on an optional integration key. Same URLs the wagmi
 * transports use (verified from browsers: publicnode echoes ACAO *,
 * sepolia.base.org echoes origin).
 */
export const publicRpcByChain: Partial<Record<GqlChain, string>> = {
  [GqlChainValues.Base]: 'https://base.publicnode.com',
  [GqlChainValues.BaseSepolia]: 'https://sepolia.base.org',
}

export function drpcUrl(chain: GqlChain, privateKey: string) {
  const chainSlug = chainToDrpcName[chain]
  if (!chainSlug) throw new Error(`Invalid chain: ${chain}`)
  return `https://lb.drpc.live/${chainSlug}/${privateKey}`
}

export function drpcUrlByChainId(chainId: number, privateKey: string) {
  const chainSlug = chainIdToDrpcName[chainId]
  if (!chainSlug) throw new Error(`Invalid chain id: ${chainId}`)
  return `https://lb.drpc.live/${chainSlug}/${privateKey}`
}
