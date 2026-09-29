import type { Address } from 'viem'
import type { OnchainPoolListItem } from '../../pool/onchain-pool-discovery'

/**
 * Rootstock: local swap-path building for onchain-only networks (BASESEP).
 *
 * Law (S100): BASESEP swaps NEVER call the remote API SOR. Paths are built
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

export function findOnchainPoolForPair(
  pools: OnchainPoolListItem[],
  tokenIn: string,
  tokenOut: string
): OnchainPoolListItem | undefined {
  const inNorm = normalizeForPoolLookup(tokenIn).toLowerCase()
  const outNorm = normalizeForPoolLookup(tokenOut).toLowerCase()
  return pools.find(pool => {
    const addresses = pool.poolTokens.map(t => t.address.toLowerCase())
    return addresses.includes(inNorm) && addresses.includes(outNorm)
  })
}

export function buildOnchainSwapPaths({
  pool,
  tokenIn,
  tokenOut,
  inputAmountRaw,
  swapType,
}: {
  pool: OnchainPoolListItem
  tokenIn: { address: string; decimals: number; symbol?: string }
  tokenOut: { address: string; decimals: number; symbol?: string }
  inputAmountRaw: bigint
  swapType: 'EXACT_IN' | 'EXACT_OUT'
}): OnchainSwapPath[] {
  const tokens: OnchainPathToken[] = [
    { index: 0, ...tokenIn, address: normalizeForPoolLookup(tokenIn.address) },
    { index: 1, ...tokenOut, address: normalizeForPoolLookup(tokenOut.address) },
  ]

  // outputAmountRaw is a placeholder estimate — the inherited onchain
  // swap.query() computes exact amounts (same as API-path flow today).
  const outputAmountRaw = inputAmountRaw

  return [
    {
      pools: [pool.address as Address],
      tokens,
      inputAmountRaw,
      outputAmountRaw,
      protocolVersion: 3,
    },
  ]
}
