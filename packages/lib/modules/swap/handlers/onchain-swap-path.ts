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
  const inLower = tokenIn.toLowerCase()
  const outLower = tokenOut.toLowerCase()
  return pools.find(pool => {
    const addresses = pool.poolTokens.map(t => t.address.toLowerCase())
    return addresses.includes(inLower) && addresses.includes(outLower)
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
    { index: 0, ...tokenIn },
    { index: 1, ...tokenOut },
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
