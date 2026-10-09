import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { shouldUseAnvilFork } from '@repo/lib/config/app.config'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'

/**
 * Rootstock onchain pool discovery.
 *
 * Law (S100): onchain-only networks (BASESEP) discover pools from the Vault
 * PoolRegistered events + direct reads — NEVER from the remote API.
 *
 * Verified live 2026-09-22:
 * - topic0 0xbc1561ee... = PoolRegistered(address indexed pool, address indexed factory, ...)
 * - 9 pools found on our Vault incl. direct deploys (factory events alone missed one)
 * - publicnode's historical log index is BROKEN for our window (receipts vanish too);
 *   sepolia.base.org serves everything → discovery MUST use base.org
 * - direct pool reads verified: name, symbol, getTokens, totalSupply
 */

export const POOL_REGISTERED_TOPIC0 =
  '0xbc1561eeab9f40962e2fb827a7ff9c7cdb47a9d7c84caeefa4ed90e043842dad'

export const ONCHAIN_DISCOVERY_RPC_URL = 'https://sepolia.base.org'

export function getOnchainDiscoveryRpcUrl(): string {
  return ONCHAIN_DISCOVERY_RPC_URL
}

/** Vault address on our Base Sepolia deployment (LIVE_DEPLOYMENTS.md, verified). */
export const BASESEP_VAULT = '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9'

/** Factory → GqlPoolType (addresses from LIVE_DEPLOYMENTS.md, 2026-09-18 deploy). */
export const FACTORY_TO_POOL_TYPE: Map<string, GqlPoolType> = new Map([
  ['0x277d7dde3c6762c31cfb438c9331376fe8887a7c', 'WEIGHTED'],
  ['0x24ab9fba48e54b05c24a02122c4c40fd2018ba10', 'STABLE'],
  ['0x6cd1150ccc00e0d00cd3f671a8bdf00d38f5be6e', 'STABLE'],
  ['0x458d984f6216daffc9da4577fc949bcab0e52b6d', 'GYRO'],
  ['0x6057859cc86aa62c54860e1a342f60ab42098efe', 'GYROE'],
  ['0x928e433f50fa579c9be5f7e1273f1db46d630ee1', 'RECLAMM'],
  ['0xdfdddd87dc49756dd93598123879ae3d67b531a3', 'LIQUIDITY_BOOTSTRAPPING'],
  ['0x9a30757385012495a21d64c5efac335b1a6fe48d', 'LIQUIDITY_BOOTSTRAPPING'],
  // Rootstock Base MAINNET (8453) factories — deployed 2026-10-03 (S113c live).
  ['0x9a5bd368c8da0d7fad33fc89b6be4e39e5a33f92', 'WEIGHTED'],
  ['0x74c9804b4659feb7d056f150a810c4b5ae926da1', 'STABLE'],
  ['0x179bdcaebadf57d6be08db5776781f4d0b64d5ce', 'STABLE'],
  ['0x8da17c9a51b3bbc4a4c951edce5cd9764e42a985', 'GYRO'],
  ['0xf7024eb7d37e993c8959090c84762f6273e43682', 'GYROE'],
  ['0x730bf6af759e9e74aa6f9f0950e233df974d1859', 'RECLAMM'],
  ['0xf5cac7d8e637d2827c07c44ae4767093647b0867', 'LIQUIDITY_BOOTSTRAPPING'],
  ['0x5dbd872f506ab714bf4d9c20675598d9f1495ba8', 'LIQUIDITY_BOOTSTRAPPING'],
])

export interface DiscoveredPool {
  address: string
  factory: string
  blockNumber: number
  name?: string
  symbol?: string
  tokens?: string[]
  totalSupply?: bigint
  swapFeePercentage?: bigint
}

export interface OnchainPoolListItem {
  id: string
  address: string
  chain: GqlChain
  type: GqlPoolType
  protocolVersion: 3
  symbol: string
  name: string
  factory: string
  createTime: number
  // S100b F6: tokens carry optional ERC20 metadata (symbol/name/decimals)
  // from the enriched baked registry — pills render symbol text, not icons.
  poolTokens: {
    address: string
    weight?: string
    symbol?: string
    name?: string
    decimals?: number
  }[]
  /** Table rows require dynamicData (PoolListTableRow reads totalLiquidity,
   * volume24h, aprItems). Onchain pools carry a zero-stub — the IPFS app is
   * code-not-data; live analytics stay backend-side (S94 law). */
  dynamicData: {
    totalLiquidity: string
    volume24h: string
    fees24h: string
    aprItems: never[]
  }
}

export function mapDiscoveredPoolToListItem(dp: DiscoveredPool): OnchainPoolListItem {
  const poolType = FACTORY_TO_POOL_TYPE.get(dp.factory.toLowerCase())
  return {
    id: dp.address,
    address: dp.address,
    chain: GqlChainValues.BaseSepolia,
    type: (poolType ?? 'WEIGHTED') as GqlPoolType,
    protocolVersion: 3,
    symbol: dp.symbol ?? '',
    name: dp.name ?? dp.symbol ?? dp.address,
    factory: dp.factory,
    createTime: dp.blockNumber,
    poolTokens: (dp.tokens ?? []).map(address => ({ address })),
    dynamicData: {
      totalLiquidity: '0',
      volume24h: '0',
      fees24h: '0',
      aprItems: [],
    },
  }
}

/**
 * S109 (Boss live E2E walk 2026-09-30): per-chain onchain scan config.
 * The live Base swap error routed through UPSTREAM Balancer pools — our
 * chains build swap paths from OUR pools only. Base mainnet (8453) has no
 * Rootstock vault yet (deploys with the mainnet release) — the scan
 * honestly returns zero pools instead of leaking upstream routing.
 */
export interface OnchainScanConfig {
  chainId: number
  rpcUrl: string
  vault: string
  fromBlock: number
}

export const ONCHAIN_SCAN_CONFIGS: Partial<Record<GqlChain, OnchainScanConfig>> = {
  [GqlChainValues.BaseSepolia]: {
    chainId: 84532,
    rpcUrl: ONCHAIN_DISCOVERY_RPC_URL,
    vault: BASESEP_VAULT,
    fromBlock: 46_984_000,
  },
  // Rootstock Base MAINNET (8453) — deployed 2026-10-03 (S113c live, S113d wiring).
  // Vault CREATE2-exact prediction match; deploy window starts block 52131550.
  [GqlChainValues.Base]: {
    chainId: 8453,
    rpcUrl: 'https://base.publicnode.com',
    vault: '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
    fromBlock: 52_131_550,
  },
}

export function getOnchainScanConfig(chain: GqlChain): OnchainScanConfig | undefined {
  return ONCHAIN_SCAN_CONFIGS[chain]
}

/*
  S114b: deployment-readiness predicate for the create wizards (pool + LBP).
  Shipped law (S110): ROOTSTOCK factories exist only where OUR stack is
  deployed — honest gate until the Rootstock mainnet release. Under the
  NEXT_PUBLIC_E2E_DEV fork gate the harness runs against the upstream ETHEREUM
  fork where the upstream factories DO exist, so every defined chain is
  deployment-capable for spec flows. Shipped builds never set the var:
  predicate identical to the shipped law.
*/
export function isDeploymentReadyChain(chain?: GqlChain): boolean {
  if (!chain) return false
  if (shouldUseAnvilFork) return true
  return !!getOnchainScanConfig(chain)
}

export function isOnchainDiscoveryNetwork(chain: GqlChain): boolean {
  return isOnchainOnlyNetwork(chain)
}
