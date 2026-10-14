import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { keyBy } from 'lodash'
import { Config, NetworkConfig, SupportedChainId } from './config.types'
import networks from './networks'
import { zeroAddress } from 'viem'

if (!process.env.NEXT_PUBLIC_BALANCER_API_URL) {
  throw new Error(
    `NEXT_PUBLIC_BALANCER_API_URL is missing in your .env vars.
    Please follow the instructions to create .env.local from README.md`
  )
}

export const config: Config = {
  appEnv: (process.env.NEXT_PUBLIC_APP_ENV as Config['appEnv']) || 'dev',
  apiUrl: process.env.NEXT_PUBLIC_BALANCER_API_URL,
  networks,
}

// Finite tx deadline — replaces upstream's effectively-forever
// BigInt(Number.MAX_SAFE_INTEGER) permit2 approvals. 20 minutes covers
// normal confirmation windows; deliberate divergence from upstream.
export const ROOTSTOCK_TX_DEADLINE_SECONDS = 20 * 60

export const isDev = process.env.NEXT_PUBLIC_APP_ENV === 'dev'
export const isProd = process.env.NEXT_PUBLIC_APP_ENV === 'prod'
export const isStaging = process.env.NEXT_PUBLIC_APP_ENV === 'staging'
/*
  Used by E2E dev tests to setup wagmi config to use an anvil fork
  It is also recommended to set NEXT_PUBLIC_E2E_DEV when using Rivet
*/
export const shouldUseAnvilFork = !!process.env.NEXT_PUBLIC_E2E_DEV

const networksByChainId = keyBy(config.networks, 'chainId')

/**
 * Fetches network config by chainId or network name type from API (GqlChain). If chain
 * param is not provided or incorrect, it will return the defaultNetwork config.
 */
export function getNetworkConfig(
  chain?: GqlChain | number,
  defaultNetwork?: GqlChain
): NetworkConfig {
  // cannot get default network directly from config here
  if (!chain) return config.networks[defaultNetwork || GqlChainValues.Mainnet] as NetworkConfig

  if (typeof chain === 'number') {
    return networksByChainId[chain] || (config.networks.MAINNET as NetworkConfig)
  }

  return config.networks[chain] || (config.networks.MAINNET as NetworkConfig)
}

export function getChainId(gqlChain: GqlChain): SupportedChainId {
  return getNetworkConfig(gqlChain).chainId as SupportedChainId
}

export function getGqlChain(chainId: SupportedChainId): GqlChain {
  return getNetworkConfig(chainId).chain
}

export function getChainIds(chains: GqlChain[]): SupportedChainId[] {
  return chains.map(chain => getChainId(chain))
}

export function getNativeAsset(chainId: GqlChain | SupportedChainId) {
  return getNetworkConfig(chainId).tokens.nativeAsset
}

export function getNativeAssetAddress(chainId: GqlChain | SupportedChainId) {
  return getNetworkConfig(chainId).tokens.nativeAsset.address
}

export function getWrappedNativeAssetAddress(chainId: GqlChain | SupportedChainId) {
  return getNetworkConfig(chainId).tokens.addresses.wNativeAsset
}

export function getChainName(chainId: GqlChain | SupportedChainId) {
  return getNetworkConfig(chainId).name
}

export function getChainShortName(chainId: GqlChain | SupportedChainId) {
  return getNetworkConfig(chainId).shortName
}

export function hasRelayerBeenDeployed(chainId: SupportedChainId) {
  const config = getNetworkConfig(chainId)

  return (
    config.contracts.balancer.relayerV6 !== zeroAddress &&
    config.contracts.balancer.vaultV2 !== zeroAddress
  )
}
