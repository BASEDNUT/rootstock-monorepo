import { createPublicClient, http, erc20Abi, type Address, type PublicClient } from 'viem'
import { baseSepolia } from 'viem/chains'
import { BaseDefaultSwapHandler } from './BaseDefaultSwap.handler'
import {
  buildOnchainSwapPaths,
  findOnchainPoolForPair,
} from './onchain-swap-path'
import {
  getOnchainDiscoveryRpcUrl,
  type OnchainPoolListItem,
} from '../../pool/onchain-pool-discovery'
import { fetchDiscoveredPools } from '../../pool/onchain-pool-fetch'
import type { SimulateSwapInputs, SdkSimulateSwapResponse } from '../swap.types'
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
export class OnchainSwapHandler extends BaseDefaultSwapHandler {
  name = 'OnchainSwapHandler'
  private client: PublicClient
  private poolsCache: OnchainPoolListItem[] | undefined

  constructor() {
    super()
    this.client = createPublicClient({
      chain: baseSepolia,
      transport: http(getOnchainDiscoveryRpcUrl()),
    })
  }

  private async getPools(): Promise<OnchainPoolListItem[]> {
    if (!this.poolsCache) {
      this.poolsCache = await fetchDiscoveredPools()
    }
    return this.poolsCache
  }

  private async getTokenDecimals(address: Address): Promise<number> {
    if (address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') return 18 // native ETH
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
    if (chain !== 'BASESEP') throw new Error('OnchainSwapHandler only for BASESEP')

    const pools = await this.getPools()
    const pool = findOnchainPoolForPair(pools, tokenIn, tokenOut)
    if (!pool) {
      throw new Error(
        `No onchain pool found for pair ${tokenIn}/${tokenOut} on Base Sepolia`
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
