import { createPublicClient, http, erc20Abi, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { Swap, SwapKind, balancerV3Contracts } from '@balancer/sdk'
import { BaseDefaultSwapHandler } from './BaseDefaultSwap.handler'
import {
  buildOnchainSwapPaths,
  findOnchainPoolsForPair,
  parseGivenAmountRaw,
} from './onchain-swap-path'
import { getOnchainScanConfig, type OnchainPoolListItem } from '../../pool/onchain-pool-discovery'
import { fetchDiscoveredPools } from '../../pool/onchain-pool-fetch'
import type { SimulateSwapInputs, SdkSimulateSwapResponse } from '../swap.types'
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { getChainId } from '../../../config/app.config'
import { getRpcUrl } from '../../web3/transports'
import { ProtocolVersion } from '../../pool/pool.types'
import { ROOTSTOCK_DEPLOYMENTS } from '../../../config/rootstock-deployments'

/**
 * Rootstock: swap handler for onchain-only networks (BASESEP).
 *
 * Law: never calls the remote API SOR. Paths are built locally from
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
 * Base mainnet wired 2026-10-03 (upstream 8453 values REPLACED:
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

  // FIX-1 (F-03a): every value resolves from the ONE canonical
  // registry (config/rootstock-deployments.ts) — kills the literal
  // duplication and the import-order fragility class (F-03): network
  // config (base.ts), AddressProvider call sites, and this SDK table
  // patch all read the same immutable source. Idempotent: re-patching
  // writes the same registry values (the old 84532 already-patched
  // early-return is subsumed — registry values are stable).
  for (const [chainKey, deployment] of Object.entries(ROOTSTOCK_DEPLOYMENTS)) {
    const chainId = Number(chainKey)

    table.Router[chainId] = deployment.router
    table.BatchRouter[chainId] = deployment.batchRouter
    table.CompositeLiquidityRouter[chainId] = deployment.compositeLiquidityRouter
    table.Vault[chainId] = deployment.vault
    // Pool factories + hooks (create-flow funds trap: upstream's values
    // would deploy pools through THEIR factories onto THEIR vault).
    table.WeightedPoolFactory[chainId] = deployment.factories.weightedPoolFactory
    table.StablePoolFactory[chainId] = deployment.factories.stablePoolFactory
    table.StableSurgePoolFactory[chainId] = deployment.factories.stableSurgePoolFactory

    // SDK 6.2.0 table has NO Gyro2CLPPoolFactory key (verified across dist) —
    // an unguarded assignment throws at module load (latent crash caught by
    // onchain-swap-sdk-table.spec.ts). Guard: patch only if the key exists.
    if (table.Gyro2CLPPoolFactory && deployment.factories.gyro2ClpPoolFactory) {
      table.Gyro2CLPPoolFactory[chainId] = deployment.factories.gyro2ClpPoolFactory
    }

    table.GyroECLPPoolFactory[chainId] = deployment.factories.gyroEclpPoolFactory
    table.ReClammPoolFactory[chainId] = deployment.factories.reClammPoolFactory
    table.LBPoolFactory[chainId] = deployment.factories.lbPoolFactory
    table.FixedPriceLBPoolFactory[chainId] = deployment.factories.fixedPriceLbPoolFactory
    table.MevCaptureHook[chainId] = deployment.hooks.mevCaptureHook
    table.StableSurgeHook[chainId] = deployment.hooks.stableSurgeHook
    table.BufferRouter[chainId] = deployment.bufferRouter
    table.UnbalancedAddViaSwapRouter[chainId] = deployment.unbalancedAddViaSwapRouter
    table.VaultAdmin[chainId] = deployment.vaultAdmin
    table.VaultExtension[chainId] = deployment.vaultExtension
  }
}

patchSdkAddressTableForRootstock()

/** Max candidate pools compared per general-swap quote round when liquidity
 * analytics exist (staticcall budget — ranked by liquidity first). */
const MAX_QUOTE_COMPARISON_CANDIDATES = 5

/**
 * F-03 (2026-10-13): when NO candidate carries liquidity analytics, ranking
 * is blind — a recency-ordered cap would exclude an older pool with a
 * materially better executable price before it is ever quoted. Quote every
 * candidate instead (bounded so a pathological pair count cannot storm the
 * RPC with staticcalls).
 */
const MAX_BLIND_QUOTE_CANDIDATES = 20

/** True when at least one candidate carries usable liquidity analytics. */
function hasLiquidityAnalytics(candidates: OnchainPoolListItem[]): boolean {
  return candidates.some(c => Number(c.dynamicData.totalLiquidity ?? 0) > 0)
}

/**
 * Deterministic candidate ranking before the comparison cap: liquidity
 * DESC (null = no analytics data = 0), then newest first, then address ASC.
 * A stable order independent of scan/discovery ordering — the same
 * candidate set always produces the same comparison shortlist.
 */
function rankCandidates(candidates: OnchainPoolListItem[]): OnchainPoolListItem[] {
  return [...candidates].sort((a, b) => {
    const liqA = Number(a.dynamicData.totalLiquidity ?? 0)
    const liqB = Number(b.dynamicData.totalLiquidity ?? 0)

    if (liqA !== liqB) return liqB - liqA // higher liquidity first
    if (a.createTime !== b.createTime) return b.createTime - a.createTime // newer first

    return a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1 // stable ASC
  })
}

/**
 * Balancer pool IDs are `<20-byte pool address><12-byte suffix>` — the pool
 * address is the id prefix. A requested id matches a candidate pool when
 * the id starts with the pool address (case-insensitive).
 */
function poolIdMatchesPool(poolId: string, poolAddress: string): boolean {
  const id = poolId.toLowerCase()
  const addr = poolAddress.toLowerCase()
  return id === addr || id.startsWith(addr)
}

export class OnchainSwapHandler extends BaseDefaultSwapHandler {
  name = 'OnchainSwapHandler'
  private client
  private chain
  private poolsCache: OnchainPoolListItem[] | undefined

  // (maintainer live verdict 2026-09-30): the handler is constructed during
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

    if (!this.client) {
      throw new Error(
        `Token decimals unavailable for ${address} — no RPC client for ${this.chain} — swap aborted (never guess precision)`
      )
    }

    try {
      return await this.client.readContract({
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      })
    } catch (err) {
      // Fail closed (auditor finding): a decimals read failure must never
      // fall back to a guessed 18 — a 6-decimal token scaled by 10^18 is a
      // raw-amount error of 10^12. Unreadable precision = no transaction.
      const detail = err instanceof Error ? ` (cause: ${err.message})` : ''

      throw new Error(
        `Token decimals unreadable for ${address} on ${this.chain} — swap aborted (never guess precision)${detail}`,
        { cause: err }
      )
    }
  }

  async simulate({ ...inputs }: SimulateSwapInputs): Promise<SdkSimulateSwapResponse> {
    const { chain, tokenIn, tokenOut, swapType, swapAmount, poolIds } = inputs

    // Repo law: our chains only — never upstream networks
    if (chain !== 'BASESEP' && chain !== 'BASE') {
      throw new Error(`OnchainSwapHandler does not support chain ${chain}`)
    }

    const pools = await this.getPools()
    const candidates = findOnchainPoolsForPair(pools, tokenIn, tokenOut)

    if (candidates.length === 0) {
      throw new Error(
        `No ${this.chain === 'BASE' ? 'Rootstock mainnet' : 'Rootstock Base Sepolia'} pool found for pair ${tokenIn}/${tokenOut} — pools deploy with the ${this.chain === 'BASE' ? 'mainnet release' : 'testnet vault'}`
      )
    }

    const [inDecimals, outDecimals] = await Promise.all([
      this.getTokenDecimals(tokenIn as Address),
      this.getTokenDecimals(tokenOut as Address),
    ])

    // Scale by the SPECIFIED token's decimals (EXACT_IN → input;
    // EXACT_OUT → output) — never the max of the two.
    const specifiedAmountRaw = parseGivenAmountRaw(
      String(swapAmount || '0'),
      swapType as 'EXACT_IN' | 'EXACT_OUT',
      inDecimals,
      outDecimals
    )

    const tokenInMeta = { address: tokenIn, decimals: inDecimals }
    const tokenOutMeta = { address: tokenOut, decimals: outDecimals }

    let pool: OnchainPoolListItem

    if (poolIds && poolIds.length > 0) {
      // Pool-specific swap: restrict candidates to the REQUESTED pool ids.
      // The requested pool must exist AND hold the token pair — otherwise
      // FAIL EXPLICITLY. Never a silent fallback to a different pool.
      const requested = candidates.filter(c => poolIds.some(id => poolIdMatchesPool(id, c.address)))

      if (requested.length === 0) {
        throw new Error(
          `Requested pool ${poolIds[0]} is not available on ${this.chain} for pair ${tokenIn}/${tokenOut} — no fallback to another pool`
        )
      }

      pool =
        requested.length === 1
          ? requested[0]!
          : // Multiple requested pools all hold the pair — best quote wins
            // among the REQUESTED set only (never a foreign pool).
            await this.selectBestQuote(
              requested,
              tokenInMeta,
              tokenOutMeta,
              specifiedAmountRaw,
              swapType as 'EXACT_IN' | 'EXACT_OUT'
            )
    } else if (candidates.length === 1) {
      // General swap, single candidate — execute directly, no comparison round.
      pool = candidates[0]!
    } else {
      // General swap, multiple candidates — quote-compare via staticcall
      // (V3 Swap.query through the patched SDK path). Candidates are ranked
      // deterministically BEFORE the cap: totalLiquidity DESC (null = no
      // analytics data = 0), then newest first, then address ASC — a stable
      // order independent of scan/discovery ordering.
      // F-03 (2026-10-13): WITH liquidity analytics the cap is 5 (top by
      // liquidity); WITHOUT any analytics the ranking is blind — quote
      // every candidate (cap 20) so the best executable price is never
      // excluded by recency.
      const ranked = rankCandidates(candidates)

      const cap = hasLiquidityAnalytics(candidates)
        ? MAX_QUOTE_COMPARISON_CANDIDATES
        : MAX_BLIND_QUOTE_CANDIDATES

      pool = await this.selectBestQuote(
        ranked.slice(0, cap),
        tokenInMeta,
        tokenOutMeta,
        specifiedAmountRaw,
        swapType as 'EXACT_IN' | 'EXACT_OUT'
      )
    }

    const paths = buildOnchainSwapPaths({
      pool,
      tokenIn: tokenInMeta,
      tokenOut: tokenOutMeta,
      specifiedAmountRaw,
      swapType: swapType as 'EXACT_IN' | 'EXACT_OUT',
    })

    return this.runSimulation({
      protocolVersion: 3 as ProtocolVersion,
      swapInputs: inputs,
      paths: paths as never[], // Path[] compatible shape
      hopCount: 1,
    })
  }

  /**
   * Quote-compare candidates via the onchain V3 Swap.query staticcall (the
   * same exact path the inherited runSimulation uses). EXACT_IN picks the
   * maximum output; EXACT_OUT picks the minimum input.
   */
  private async selectBestQuote(
    candidates: OnchainPoolListItem[],
    tokenIn: { address: string; decimals: number },
    tokenOut: { address: string; decimals: number },
    specifiedAmountRaw: bigint,
    swapType: 'EXACT_IN' | 'EXACT_OUT'
  ): Promise<OnchainPoolListItem> {
    const swapKind = swapType === 'EXACT_IN' ? SwapKind.GivenIn : SwapKind.GivenOut

    const rpcUrl = getRpcUrl(getChainId(this.chain))

    // One failed quote must never kill the comparison (auditor finding): a
    // reverting, paused, or otherwise unquotable candidate is excluded and
    // the winner is selected among the pools that DID quote. Only an
    // all-failed round is an error — routing must never depend on every
    // pool being quotable at the same instant.
    const settled = await Promise.allSettled(
      candidates.map(async candidate => {
        const paths = buildOnchainSwapPaths({
          pool: candidate,
          tokenIn,
          tokenOut,
          specifiedAmountRaw,
          swapType,
        })

        const swap = new Swap({
          chainId: getChainId(this.chain),
          paths: paths as never[],
          swapKind,
        })

        const output = await swap.query(rpcUrl)

        const amount =
          output.swapKind === SwapKind.GivenIn
            ? output.expectedAmountOut.amount
            : output.expectedAmountIn.amount

        return { candidate, amount }
      })
    )

    const quoted = settled
      .filter(
        (s): s is PromiseFulfilledResult<{ candidate: OnchainPoolListItem; amount: bigint }> =>
          s.status === 'fulfilled'
      )
      .map(s => s.value)

    if (quoted.length === 0) {
      throw new Error(
        `All candidate pools failed to quote for ${tokenIn.address}/${tokenOut.address} on ${this.chain} — no pool is quotable right now`
      )
    }

    const best = quoted.reduce((acc, cur) => {
      if (swapType === 'EXACT_IN') {
        // max output wins
        return !acc || cur.amount > acc.amount ? cur : acc
      }

      // EXACT_OUT: min input wins
      return !acc || cur.amount < acc.amount ? cur : acc
    })

    return best.candidate
  }
}
