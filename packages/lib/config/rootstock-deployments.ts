import type { Address } from 'viem'
import { AddressProvider } from '@balancer/sdk'

/**
 * FIX-1 (F-03a): the canonical Rootstock deployment registry — the ONE
 * immutable, chain-specific source every address consumer resolves from
 * (network config base.ts, AddressProvider call sites, the SDK table patch).
 * Config leaf: no imports from modules (no cycles).
 *
 * Values: rootstock/LIVE_DEPLOYMENTS.md (byte-checked against
 * modules/swap/handlers/onchain-swap-sdk-table.spec.ts, both chains).
 * Upstream Balancer's live Base infrastructure points elsewhere — routing
 * through upstream literals is the F-03 misroute class.
 *
 * Fields are viem `Address` (0x-prefixed template literal) so NetworkConfig
 * consumers typecheck without casts (handoff sketched `string`; Address is
 * the honest narrowing — documented deviation).
 */

export interface RootstockDeployment {
  vault: Address
  router: Address
  batchRouter: Address
  compositeLiquidityRouter: Address
  vaultAdmin: Address
  vaultExtension: Address
  unbalancedAddViaSwapRouter: Address
  bufferRouter: Address
  factories: {
    weightedPoolFactory: Address
    stablePoolFactory: Address
    stableSurgePoolFactory: Address
    gyro2ClpPoolFactory?: Address
    gyroEclpPoolFactory: Address
    reClammPoolFactory: Address
    lbPoolFactory: Address
    fixedPriceLbPoolFactory: Address
  }
  hooks: { mevCaptureHook: Address; stableSurgeHook: Address }
}

export const ROOTSTOCK_DEPLOYMENTS: Record<number, RootstockDeployment> = {
  // Rootstock Base MAINNET (8453) — deployed 2026-10-03 (live).
  8453: {
    vault: '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7',
    router: '0xc8dcC030C81635Da8df2D7fb35573E661B01cDCe',
    batchRouter: '0x1428F95C891669f49299634076292215b2B78A31',
    compositeLiquidityRouter: '0xA14865dC542e075F6c3e3c8D49be68a1b2D1a758',
    vaultAdmin: '0xFbE459C6D811d474464F0209296590BBe35814Ca',
    vaultExtension: '0x2234Add4f8284e98cA51830678D6A66553506a07',
    unbalancedAddViaSwapRouter: '0x9e586F22ab23A0040231E78a4d021B5f761036E5',
    bufferRouter: '0xEa94Cee1C04E50e43935c4078F69B68df3Dc3946',
    factories: {
      weightedPoolFactory: '0x9a5bd368C8dA0d7fad33Fc89b6be4e39E5A33F92',
      stablePoolFactory: '0x74c9804b4659fEb7d056F150a810C4B5ae926DA1',
      stableSurgePoolFactory: '0x179BdCaeBADF57d6Be08DB5776781F4D0B64d5ce',
      gyro2ClpPoolFactory: '0x8dA17C9a51B3BBc4A4C951eDCE5cD9764e42a985',
      gyroEclpPoolFactory: '0xF7024Eb7D37e993c8959090C84762F6273e43682',
      reClammPoolFactory: '0x730bF6Af759e9E74aa6f9F0950e233dF974D1859',
      lbPoolFactory: '0xf5CAC7d8e637D2827C07c44Ae4767093647b0867',
      fixedPriceLbPoolFactory: '0x5dBd872F506aB714bF4D9C20675598D9F1495bA8',
    },
    hooks: {
      mevCaptureHook: '0xfE807044D0329BD96aEa42A78F091c2Db1069f42',
      stableSurgeHook: '0x2Bdde9A6e0f9ad3f7349E09617cF7fEB655c5981',
    },
  },
  // Rootstock Base SEPOLIA (84532) — deployed 2026-09-18.
  84532: {
    vault: '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9',
    router: '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759',
    batchRouter: '0x41978EB90477d4D971dF22111B2d09679f4DadA6',
    compositeLiquidityRouter: '0x5808B214B66C70e6c0759803AbF3498c2c78F437',
    vaultAdmin: '0xC67111C130b1380E5ba027733315DE82bB5A6837',
    vaultExtension: '0x8e86fDf21a578cDB01F1A58c71a2ef21dBBE2A8E',
    unbalancedAddViaSwapRouter: '0xbbEc9F2c69037852A86aB3F97326172649E82337',
    bufferRouter: '0xe1c7A291D4eBa814f36Ec96fD10F343A53BFa1D7',
    factories: {
      weightedPoolFactory: '0x277D7dDe3C6762C31CfB438c9331376fE8887A7c',
      stablePoolFactory: '0x24Ab9fBA48E54b05c24a02122C4c40fD2018bA10',
      stableSurgePoolFactory: '0x6cD1150ccc00e0D00Cd3f671a8bdf00d38f5BE6e',
      gyro2ClpPoolFactory: '0x458d984F6216DAffC9dA4577Fc949BcAb0e52b6D',
      gyroEclpPoolFactory: '0x6057859CC86AA62c54860e1A342f60ab42098Efe',
      reClammPoolFactory: '0x928E433f50fa579c9be5f7e1273F1db46D630EE1',
      lbPoolFactory: '0xDfDddD87dC49756DD93598123879AE3D67B531a3',
      fixedPriceLbPoolFactory: '0x9A30757385012495A21D64c5EfAC335B1A6fE48D',
    },
    hooks: {
      mevCaptureHook: '0x7E50a9dB8252414AAD240E08b9ed4176C4D64888',
      stableSurgeHook: '0x581e1dE0C136134AF479d09619b5f950420A427D',
    },
  },
}

/** The chain-matching registry entry — throws for chains we did not deploy. */
export function getRootstockDeployment(chainId: number): RootstockDeployment {
  const deployment = ROOTSTOCK_DEPLOYMENTS[chainId]

  if (!deployment) {
    throw new Error(`No Rootstock deployment for chainId: ${chainId}`)
  }

  return deployment
}

/**
 * The chain vault (FIX-4 AddressProvider.Vault call-site replacement).
 *
 * Our chains (8453/84532) resolve STRICTLY from the registry — never from
 * the upstream SDK (the F-03 misroute class). Foreign chains fall back to
 * the upstream deployment instead of throwing: the dev E2E harness runs an
 * Ethereum-mainnet anvil fork (chainId 1) against upstream's deployment,
 * and a throw here killed wizard rendering before any button appeared.
 */
export function getRootstockVault(chainId: number): Address {
  const deployment = ROOTSTOCK_DEPLOYMENTS[chainId]

  if (deployment) {
    return deployment.vault as Address
  }

  return AddressProvider.Vault(chainId)
}
