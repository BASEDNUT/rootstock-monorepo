import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { isOnchainOnlyNetwork } from '@repo/lib/config/getProjectConfig'
import { shouldUseAnvilFork } from '@repo/lib/config/app.config'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import type { GqlPoolAprItem } from '@repo/lib/shared/services/api/graphql-derived-types'
import type { GqlPoolType } from '@repo/lib/shared/services/api/generated/graphql'
import { getRootstockHookReviewData } from '../hooks/rootstockHooks'

/**
 * Rootstock onchain pool discovery.
 *
 * Law: onchain-only networks (BASESEP) discover pools from the Vault
 * PoolRegistered events + direct reads — NEVER from the remote API.
 *
 * Verified live:
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

/** Factory → GqlPoolType (addresses from LIVE_DEPLOYMENTS.md). */
export const FACTORY_TO_POOL_TYPE: Map<string, GqlPoolType> = new Map([
  ['0x277d7dde3c6762c31cfb438c9331376fe8887a7c', 'WEIGHTED'],
  ['0x24ab9fba48e54b05c24a02122c4c40fd2018ba10', 'STABLE'],
  ['0x6cd1150ccc00e0d00cd3f671a8bdf00d38f5be6e', 'STABLE'],
  ['0x458d984f6216daffc9da4577fc949bcab0e52b6d', 'GYRO'],
  ['0x6057859cc86aa62c54860e1a342f60ab42098efe', 'GYROE'],
  ['0x928e433f50fa579c9be5f7e1273f1db46d630ee1', 'RECLAMM'],
  ['0xdfdddd87dc49756dd93598123879ae3d67b531a3', 'LIQUIDITY_BOOTSTRAPPING'],
  ['0x9a30757385012495a21d64c5efac335b1a6fe48d', 'LIQUIDITY_BOOTSTRAPPING'],
  // Rootstock Base MAINNET (8453) factories — deployed 2026-10-03 (live).
  ['0x9a5bd368c8da0d7fad33fc89b6be4e39e5a33f92', 'WEIGHTED'],
  ['0x74c9804b4659feb7d056f150a810c4b5ae926da1', 'STABLE'],
  ['0x179bdcaebadf57d6be08db5776781f4d0b64d5ce', 'STABLE'],
  ['0x8da17c9a51b3bbc4a4c951edce5cd9764e42a985', 'GYRO'],
  ['0xf7024eb7d37e993c8959090c84762f6273e43682', 'GYROE'],
  ['0x730bf6af759e9e74aa6f9f0950e233df974d1859', 'RECLAMM'],
  ['0xf5cac7d8e637d2827c07c44ae4767093647b0867', 'LIQUIDITY_BOOTSTRAPPING'],
  ['0x5dbd872f506ab714bf4d9c20675598d9f1495ba8', 'LIQUIDITY_BOOTSTRAPPING'],
])

export interface DiscoveredPoolToken {
  address: string
  symbol?: string
  name?: string
  decimals?: number
}

export interface DiscoveredPool {
  address: string
  factory: string
  blockNumber: number
  name?: string
  symbol?: string
  tokens?: (string | DiscoveredPoolToken)[]
  totalSupply?: bigint
  swapFeePercentage?: bigint
  /** External hook contract address; null = none/self-hook. */
  hook?: string | null
  /** Derived display tags (BOOSTED / PERMISSIONED). */
  tags?: string[]
}

/** Rootstock onchain display tags. */
export const ONCHAIN_TAG = {
  Boosted: 'BOOSTED',
  Permissioned: 'PERMISSIONED',
} as const

/**
 * Derive display facts from Vault-level pool state (getHooksConfig +
 * getPoolTokenInfo). Pure — shared shape with the bake generator.
 *
 * Laws:
 * - BOOSTED when ANY token is WITH_RATE (tokenType !== 0) — the pool holds
 *   a yield-bearing/rate token (wstETH, sFRAX, waBasUSDC, alUSDb, USD+).
 * - Self-hooked pool (hooksContract === pool) is PERMISSIONED, NOT a hook
 *   pool — upstream removeHookDataFromPoolIfNecessary strip law (reCLAMM
 *   uses the same self-hook shape; a hook pill would mislabel it).
 * - External hook (nonzero, not the pool) → hook address for the hook pill.
 */
export function derivePoolDisplayFacts({
  pool,
  hooksContract,
  tokenTypes,
}: {
  pool: string
  hooksContract: string
  tokenTypes: number[]
}): { hook: string | null; tags: string[] } {
  const poolLower = pool.toLowerCase()
  const hookLower = hooksContract.toLowerCase()
  const isZero = hookLower === '0x0000000000000000000000000000000000000000'
  const isSelf = hookLower === poolLower

  const hook = !isZero && !isSelf ? hooksContract : null
  const tags: string[] = []
  if (tokenTypes.some(t => t !== 0)) tags.push(ONCHAIN_TAG.Boosted)
  if (isSelf) tags.push(ONCHAIN_TAG.Permissioned)

  return { hook, tags }
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
  //  F6: tokens carry optional ERC20 metadata (symbol/name/decimals)
  // from the enriched baked registry — pills render symbol text, not icons.
  poolTokens: {
    address: string
    weight?: string
    symbol?: string
    name?: string
    decimals?: number
  }[]
  /** External hook contract (never the pool itself — self-hook = PERMISSIONED,
   * upstream reCLAMM strip law). null = no external hook. */
  hook?: {
    address: string
    reviewData?: { reviewFile?: string | null; summary: string; warnings: string[] }
  } | null
  /** Rootstock-derived display tags: BOOSTED (yield-bearing WITH_RATE token),
   * PERMISSIONED (self-hooked pool gating add/remove/init). */
  tags?: string[]
  /** Table rows require dynamicData (PoolListTableRow reads totalLiquidity,
   * volume24h, aprItems). Onchain pools carry a zero-stub — the IPFS app is
   * code-not-data; live analytics stay backend-side (S94 law). */
  dynamicData: {
    // null = unavailable (onchain-sourced pools have no analytics pipeline —
    // never a fabricated '0'; UI renders an em-dash).
    totalLiquidity: string | null
    volume24h: string | null
    fees24h: string | null
    aprItems: GqlPoolAprItem[]
  }
}

export function mapDiscoveredPoolToListItem(
  dp: DiscoveredPool,
  // Chain comes from the caller (never a hardcoded
  // BASESEP tag — a Base-mainnet pool would be mis-tagged). Default keeps
  // existing single-argument callers green.
  chain: GqlChain = GqlChainValues.BaseSepolia
): OnchainPoolListItem {
  // An unmapped factory maps to UNKNOWN - never a guessed pool type.
  // A wrong type can route UI actions to incompatible contract calls;
  // UNKNOWN renders honestly and never guesses.
  const poolType = FACTORY_TO_POOL_TYPE.get(dp.factory.toLowerCase())
  return {
    id: dp.address,
    address: dp.address,
    chain,
    type: (poolType ?? 'UNKNOWN') as GqlPoolType,
    protocolVersion: 3,
    symbol: dp.symbol ?? '',
    name: dp.name ?? dp.symbol ?? dp.address,
    factory: dp.factory,
    createTime: dp.blockNumber,
    poolTokens: (dp.tokens ?? []).map(t =>
      typeof t === 'string'
        ? { address: t }
        : { address: t.address, symbol: t.symbol, name: t.name, decimals: t.decimals }
    ),
    hook: dp.hook
      ? {
          address: dp.hook,
          reviewData: getRootstockHookReviewData(dp.hook) ?? undefined,
        }
      : null,
    tags: dp.tags ?? [],
    dynamicData: {
      totalLiquidity: null,
      volume24h: null,
      fees24h: null,
      aprItems: [],
    },
  }
}

/**
 * Per-chain onchain scan config. Swap paths build from our pools only —
 * never upstream Balancer routing. Chains without a Rootstock vault
 * honestly return zero pools.
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
  // Rootstock Base MAINNET (8453) — deployed 2026-10-03 (live, wiring).
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
  deployment-readiness predicate for the create wizards (pool + LBP).
  Shipped law: ROOTSTOCK factories exist only where OUR stack is
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
