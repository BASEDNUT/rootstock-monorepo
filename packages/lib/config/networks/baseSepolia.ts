import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'
import { NetworkConfig } from '../config.types'
import { convertHexToLowerCase } from '@repo/lib/shared/utils/objects'
import { zeroAddress } from 'viem'

// Rootstock: Base Sepolia (84532) — our deployment. Addresses from
// rootstock/LIVE_DEPLOYMENTS.md (S95, 2026-09-18); SDK 6.2.0 has no 84532
// entry, so verified literal addresses are used instead of AddressProvider.
const networkConfig: NetworkConfig = {
  chainId: 84532,
  name: 'Base Testnet Sepolia',
  shortName: 'Base Sepolia',
  chain: GqlChainValues.BaseSepolia,
  iconPath: '/images/chains/BASESEPOLIA.svg',
  blockExplorer: {
    baseUrl: 'https://sepolia.basescan.org',
    name: 'BaseScan',
  },
  tokens: {
    addresses: {
      bal: zeroAddress,
      wNativeAsset: '0x4200000000000000000000000000000000000006', // WETH (predeploy, onchain-verified)
    },
    nativeAsset: {
      name: 'Ether',
      address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      symbol: 'ETH',
      decimals: 18,
    },
    defaultSwapTokens: {
      tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    },
  },
  contracts: {
    multicall2: '0xca11bde05977b3631167028862be2a173976ca11', // Multicall3 (onchain-verified)
    balancer: {
      vaultV2: zeroAddress,
      vaultV3: '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9',
      router: '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759',
      batchRouter: '0x41978EB90477d4D971dF22111B2d09679f4DadA6',
      compositeLiquidityRouterBoosted: '0x5808B214B66C70e6c0759803AbF3498c2c78F437',
      relayerV6: zeroAddress,
      minter: zeroAddress,
      vaultAdminV3: '0xC67111C130b1380E5ba027733315DE82bB5A6837',
      unbalancedAddViaSwapRouter: '0xbbEc9F2c69037852A86aB3F97326172649E82337',
    },
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3', // canonical Permit2 (onchain-verified)
  },
  pools: convertHexToLowerCase({ issues: {} }),
  lbps: {
    collateralTokens: [
      '0x4200000000000000000000000000000000000006', // WETH
    ],
  },
}

export default networkConfig
