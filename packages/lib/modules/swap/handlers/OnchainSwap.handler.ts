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
 * Rootstock: SDK 6.2.0 AddressProvider table lacks Base Sepolia (84532).
 * Patch our verified deploy addresses (LIVE_DEPLOYMENTS.md, S95) into the
 * exported table so swap.query() can resolve Router/Vault. Runtime patch,
 * no node_modules edits. Verified live 2026-09-22.
 */
export function patchSdkAddressTableForBaseSepolia(): void {
  // SDK 6.2.0 ships the table as a readonly literal (no 84532 key) — cast to
  // a mutable record for the runtime patch. Addresses: LIVE_DEPLOYMENTS.md.
  const table = balancerV3Contracts as unknown as {
    Router: Record<number, string>
    BatchRouter: Record<number, string>
    CompositeLiquidityRouter: Record<number, string>
    Vault: Record<number, string>
  }

  if (table.Router[84532]) return // already patched
  table.Router[84532] = '0xDD9793Cd4B79a8bd65D690C64A3074D023Dfa759'
  table.BatchRouter[84532] = '0x41978EB90477d4D971dF22111B2d09679f4DadA6'
  table.CompositeLiquidityRouter[84532] = '0x5808B214B66C70e6c0759803AbF3498c2c78F437'
  table.Vault[84532] = '0xEf348c4222ab9c08aFE768AD722Fb02b10d640c9'
}

patchSdkAddressTableForBaseSepolia()

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
