/**
 * Shared constants + decode helpers for the swap-event metrics ledger.
 * Kept separate from onchain-metrics.ts so the pure-math module stays
 * free of RPC-shaped types (both spec suites import from here).
 */

export type { SwapBucket, MetricToken, RawSwapLog } from './onchain-metrics'
export {
  decodeSwapLogsToBuckets,
  aggregateSwapBuckets,
  deriveUnpricedTokenPrices,
  computePoolMetrics,
} from './onchain-metrics'

/** keccak(Swap(address,address,address,uint256,uint256,uint256,uint256)) — live-verified against our Vault. */
export const SWAP_TOPIC0 = '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db'
