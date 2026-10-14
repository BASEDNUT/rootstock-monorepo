import type { Address } from 'viem'
import type { OnchainPoolListItem } from '../../pool/onchain-pool-discovery'

/**
 * Rootstock: local swap-path building for onchain-only networks (BASESEP).
 *
 * Law: BASESEP swaps NEVER call the remote API SOR. Paths are built
 * locally from onchain-discovered pools; exact amounts come from the inherited
 * BaseDefaultSwapHandler.runSimulation → onchain swap.query(rpcUrl).
 *
 * Scope: single-pool paths only. Multi-hop routing stays backend-side (S94
 * verified law: no client-side SOR exists in the SDK).
 */

// Native ETH marker + BASESEP wrapped native. Pools hold WETH; users may
// select native ETH — equivalent for pair matching (SDK wethIsEth handles
// the tx side). Verified live 2026-09-22: mock pool tokens = [WETH, BAL].
export const NATIVE_ETH_MARKER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
export const WETH_BASESEP = '0x4200000000000000000000000000000000000006'

function normalizeForPoolLookup(address: string): string {
  if (address.toLowerCase() === NATIVE_ETH_MARKER) return WETH_BASESEP
  return address
}

export interface OnchainPathToken {
  index: number
  address: string
  decimals: number
  symbol?: string
}

export interface OnchainSwapPath {
  pools: string[]
  isBuffer?: boolean[]
  tokens: OnchainPathToken[]
  inputAmountRaw: bigint
  outputAmountRaw: bigint
  protocolVersion: 1 | 2 | 3
}

export function findOnchainPoolsForPair(
  pools: OnchainPoolListItem[],
  tokenIn: string,
  tokenOut: string
): OnchainPoolListItem[] {
  const inNorm = normalizeForPoolLookup(tokenIn).toLowerCase()
  const outNorm = normalizeForPoolLookup(tokenOut).toLowerCase()
  return pools.filter(pool => {
    const addresses = pool.poolTokens.map(t => t.address.toLowerCase())
    return addresses.includes(inNorm) && addresses.includes(outNorm)
  })
}

export function findOnchainPoolForPair(
  pools: OnchainPoolListItem[],
  tokenIn: string,
  tokenOut: string
): OnchainPoolListItem | undefined {
  return findOnchainPoolsForPair(pools, tokenIn, tokenOut)[0]
}

/**
 * Auditor F-01 fix (2026-10-09): parse a human amount to raw units using
 * the decimals of the token whose amount the user SPECIFIED —
 * EXACT_IN → input token decimals; EXACT_OUT → output token decimals.
 * Never the max of the two (the old bug scaled 1 USDC→WETH to 1e18).
 * Truncates (never rounds up) beyond token precision; malformed/negative
 * input falls back to 0n — never inflates user funds.
 */
export function parseGivenAmountRaw(
  amount: string,
  swapType: 'EXACT_IN' | 'EXACT_OUT',
  tokenInDecimals: number,
  tokenOutDecimals: number
): bigint {
  const decimals = swapType === 'EXACT_IN' ? tokenInDecimals : tokenOutDecimals
  const s = String(amount ?? '').trim()
  if (!/^\d+(\.\d*)?$/.test(s)) return 0n

  const [whole, frac = ''] = s.split('.')
  const fracScaled = (frac + '0'.repeat(decimals)).slice(0, decimals)

  return BigInt(whole + fracScaled)
}

export function buildOnchainSwapPaths({
  pool,
  tokenIn,
  tokenOut,
  specifiedAmountRaw,
}: {
  pool: OnchainPoolListItem
  tokenIn: { address: string; decimals: number; symbol?: string }
  tokenOut: { address: string; decimals: number; symbol?: string }
  specifiedAmountRaw: bigint
  swapType: 'EXACT_IN' | 'EXACT_OUT'
}): OnchainSwapPath[] {
  const tokens: OnchainPathToken[] = [
    { index: 0, ...tokenIn, address: normalizeForPoolLookup(tokenIn.address) },
    { index: 1, ...tokenOut, address: normalizeForPoolLookup(tokenOut.address) },
  ]

  // SDK law (auditor F-01, verified in @balancer/sdk 6.2.0): GivenIn consumes
  // path.inputAmount; GivenOut consumes path.outputAmount. The specified
  // amount sits on its matching side; the other side is a placeholder
  // estimate the inherited onchain swap.query() never consumes for sizing.
  return [
    {
      pools: [pool.address as Address],
      tokens,
      inputAmountRaw: specifiedAmountRaw,
      outputAmountRaw: specifiedAmountRaw,
      protocolVersion: 3,
    },
  ]
}
