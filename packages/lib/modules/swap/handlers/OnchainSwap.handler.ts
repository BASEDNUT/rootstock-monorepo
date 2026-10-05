import { createPublicClient, http, erc20Abi, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { balancerV3Contracts } from '@balancer/sdk'
import { BaseDefaultSwapHandler } from './BaseDefaultSwap.handler'
import { buildOnchainSwapPaths, findOnchainPoolForPair } from './onchain-swap-path'
import { getOnchainScanConfig, type OnchainPoolListItem } from '../../pool/onchain-pool-discovery'
import { fetchDiscoveredPools } from '../../pool/onchain-pool-fetch'
import type { SimulateSwapInputs, SdkSimulateSwapResponse } from '../swap.types'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { ProtocolVersion } from '../../pool/pool.types'

/**
 * Rootstock: swap handler for onchain-only networks (BASESEP).
 *
 * Law (S100): never calls the remote API SOR. Paths are built locally from
 * onchain-discovered pools; exact amounts via inherited runSimulation →
 * onchain swap.query(rpcUrl) — the same exactness the API flow provides.
 *
 * Single-pool scope. Multi-hop routing stays backend-side (S94 law).
 */
/**
 * Rootstock: SDK 6.2.0 AddressProvider table — patch OUR verified deploy
 * addresses (LIVE_DEPLOYMENTS.md) for BOTH our chains (8453 + 84532) into
 * the exported table so swap.query()/SDK flows resolve OUR Router/Vault.
 * Runtime patch, no node_modules edits. Sepolia verified live 2026-09-22;
 * Base mainnet wired 2026-10-03 (S113d — upstream 8453 values REPLACED:
 * the SDK ships Balancer's Base addresses; routing through them sends
 * funds to pools that are not ours).
 */
export function patchSdkAddressTableForRootstock(): void {
  // SDK 6.2.0 ships the table as a readonly literal (no 84532 key) — cast to
  // a mutable record for the runtime patch. Addresses: LIVE_DEPLOYMENTS.md.
  const table = balancerV3Contracts as unknown as {
    Router: Record<number, string>
    BatchRouter: Record<number, string>
    CompositeLiquidityRouter: Record<number, string>
    Vault: Record<number, string>
    WeightedPoolFactory: Record<number, string>
    StablePoolFactory: Record<number, string>
    StableSurgePoolFactory: Record<number, string>
    Gyro2CLPPoolFactory: Record<number, string>
    GyroECLPPoolFactory: Record<number, string>
    ReClammPoolFactory: Record<number, string>
    LBPoolFactory: Record<number, string>
    FixedPriceLBPoolFactory: Record<number, string>
    MevCaptureHook: Record<number, string>
    StableSurgeHook: Record<number, string>
    BufferRouter: Record<number, string>
    UnbalancedAddViaSwapRouter: Record<number, string>
    VaultAdmin: Record<number, string>
    VaultExtension: Record<number, string>
  }

  // S113d (2026-10-03): our Base MAINNET stack — replaces upstream's 8453
  // values in the SDK table (output/baseMainnet.json per task, S113c live).
  table.Router[8453] = '0xc8dcC030C81635Da8df2D7fb35573E661B01cDCe'
  table.BatchRouter[8453] = '0x1428F95C891669f49299634076292215b2B78A31'
  table.CompositeLiquidityRouter[8453] = '0xA14865dC542e075F6c3e3c8D49be68a1b2D1a758'
  table.Vault[8453] = '0x0a3af0Da0175afa0Cc05a6ad9092dC740155a0E7'
  // Pool factories + hooks (create-flow funds trap: upstream's 8453 values
  // would deploy pools through THEIR factories onto THEIR vault).
  table.WeightedPoolFactory[8453] = '0x9a5bd368C8dA0d7fad33Fc89b6be4e39E5A33F92'
  table.StablePoolFactory[8453] = '0x74c9804b4659fEb7d056F150a810C4B5ae926DA1'
  table.StableSurgePoolFactory[8453] = '0x179BdCaeBADF57d6Be08DB5776781F4D0B64d5ce'

  // SDK 6.2.0 table has NO Gyro2CLPPoolFactory key (verified across dist) —
  // an unguarded assignment throws at module load (latent crash caught by
  // onchain-swap-sdk-table.spec.ts). Guard: patch only if the key ever exists.
  if (table.Gyro2CLPPoolFactory) {
    table.Gyro2CLPPoolFactory[8453] = '0x8dA17C9a51B3BBc4A4C951eDCE5cD9764e42a985'
  }

  table.GyroECLPPoolFactory[8453] = '0xF7024Eb7D37e993c8959090C84762F6273e43682'
  table.ReClammPoolFactory[8453] = '0x730bF6Af759e9E74aa6f9F0950e233dF974D1859'
  table.LBPoolFactory[8453] = '0xf5CAC7d8e637D2827C07c44Ae4767093647b0867'
  table.FixedPriceLBPoolFactory[8453] = '0x5dBd872F506aB714bF4D9C20675598D9F1495bA8'
  table.MevCaptureHook[8453] = '0xfE807044D0329BD96aEa42A78F091c2Db1069f42'
  table.StableSurgeHook[8453] = '0x2Bdde9A6e0f9ad3f7349E09617cF7fEB655c5981'
  // S113-fix C-5 (2026-10-05): complete the 8453 table — the 4 keys the
  // patch missed were the unbalanced-add/buffer router + vault admin/ext
  // (misroute class: upstream routers operate against THEIR vault).
  table.BufferRouter[8453] = '0xEa94Cee1C04E50e43935c4078F69B68df3Dc3946'
  table.UnbalancedAddViaSwapRouter[8453] = '0x9e586F22ab23A0040231E78a4d021B5f761036E5'
  table.VaultAdmin[8453] = '0xFbE459C6D811d474464F0209296590BBe35814Ca'
  table.VaultExtension[8453] = '0x2234Add4f8284e98cA51830678D6A66553506a07'

  // Base Sepolia (84532) — SDK table lacks the key entirely (verified
  // live 2026-09-22). Our Sepolia deployments (LIVE_DEPLOYMENTS.md).
  if (table.Router[84532]) return // already patched
  table.Router[84532] = '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759'
  table.BatchRouter[84532] = '0x41978EB90477d4D971dF22111B2d09679f4DadA6'
  table.CompositeLiquidityRouter[84532] = '0x5808B214B66C70e6c0759803AbF3498c2c78F437'
  table.Vault[84532] = '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9'
  // C-5 84532 parity (2026-10-05): SDK table lacks these keys on 84532.
  table.BufferRouter[84532] = '0xe1c7A291D4eBa814f36Ec96fD10F343A53BFa1D7'
  table.UnbalancedAddViaSwapRouter[84532] = '0xbbEc9F2c69037852A86aB3F97326172649E82337'
  table.VaultAdmin[84532] = '0xC67111C130b1380E5ba027733315DE82bB5A6837'
  table.VaultExtension[84532] = '0x8e86fDf21a578cDB01F1A58c71a2ef21dBBE2A8E'
}

patchSdkAddressTableForRootstock()

export class OnchainSwapHandler extends BaseDefaultSwapHandler {
  name = 'OnchainSwapHandler'
  private client
  private chain
  private poolsCache: OnchainPoolListItem[] | undefined

  // S110 (Boss live verdict 2026-09-30): the handler is constructed during
  // render — it must NEVER throw. Chains without a deployed Rootstock vault
  // (Base mainnet until the mainnet release) honestly return zero pools at
  // ACTION time ('no pool found — pools deploy with the mainnet release'),
  // never a dead page.
  private scanConfig: ReturnType<typeof getOnchainScanConfig>

  constructor(chain: GqlChain) {
    super()

    this.chain = chain
    const scanConfig = getOnchainScanConfig(chain)
    this.scanConfig = scanConfig

    if (scanConfig) {
      this.client = createPublicClient({
        chain: scanConfig.chainId === 84532 ? baseSepolia : base,
        transport: http(scanConfig.rpcUrl),
      })
    }
  }

  private async getPools(): Promise<OnchainPoolListItem[]> {
    if (!this.scanConfig) return []

    if (!this.poolsCache) {
      this.poolsCache = await fetchDiscoveredPools(this.chain)
    }

    return this.poolsCache
  }

  private async getTokenDecimals(address: Address): Promise<number> {
    if (address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return 18 // native ETH

    if (!this.client) return 18 // no scan config — never reached (no-pool throw first)

    try {
      return await this.client.readContract({
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      })
    } catch {
      return 18
    }
  }

  async simulate({ ...inputs }: SimulateSwapInputs): Promise<SdkSimulateSwapResponse> {
    const { chain, tokenIn, tokenOut, swapType, swapAmount } = inputs

    // S109: our chains only — never upstream networks
    if (chain !== 'BASESEP' && chain !== 'BASE') {
      throw new Error(`OnchainSwapHandler does not support chain ${chain}`)
    }

    const pools = await this.getPools()
    const pool = findOnchainPoolForPair(pools, tokenIn, tokenOut)

    if (!pool) {
      throw new Error(
        `No ${this.chain === 'BASE' ? 'Rootstock mainnet' : 'Rootstock Base Sepolia'} pool found for pair ${tokenIn}/${tokenOut} — pools deploy with the ${this.chain === 'BASE' ? 'mainnet release' : 'testnet vault'}`
      )
    }

    const [inDecimals, outDecimals] = await Promise.all([
      this.getTokenDecimals(tokenIn as Address),
      this.getTokenDecimals(tokenOut as Address),
    ])

    // parse human amount to raw using decimals
    const amountStr = String(swapAmount || '0')
    const [whole, frac = ''] = amountStr.split('.')
    const fracPadded = (frac + '0'.repeat(18)).slice(0, Math.max(inDecimals, outDecimals))
    const combined = BigInt(whole + fracPadded || '0')
    const inputAmountRaw = combined

    const paths = buildOnchainSwapPaths({
      pool,
      tokenIn: { address: tokenIn, decimals: inDecimals },
      tokenOut: { address: tokenOut, decimals: outDecimals },
      inputAmountRaw,
      swapType: swapType as 'EXACT_IN' | 'EXACT_OUT',
    })

    return this.runSimulation({
      protocolVersion: 3 as ProtocolVersion,
      swapInputs: inputs,
      paths: paths as never[], // Path[] compatible shape
      hopCount: 1,
    })
  }
}
