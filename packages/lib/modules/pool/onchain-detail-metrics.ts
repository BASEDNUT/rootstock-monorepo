/**
 * Detail-page onchain metrics merge (D1, live-caught 2026-10-27).
 *
 * Pool DETAIL pages rendered the hardcoded dynamicData stub from
 * PoolLayout's buildOnchainPoolData (volume24h: '0', fees24h: '0') —
 * tsPHILO detail showed "Swap vol (24h) $0.00" while the same pool's
 * list row showed the true $2.02. Detail must never contradict the
 * list: onchain-built pools get their dynamicData merged from the same
 * metrics source the list uses (useOnchainPoolMetrics).
 *
 * Contract (nut-contract-first):
 * - Inputs: pool (GqlPool-shaped, address + dynamicData), enriched list
 *   (OnchainPoolListItem[] from useOnchainPoolMetrics)
 * - Output: shallow-cloned pool with merged dynamicData
 * - Error modes: none — missing entries / missing fields fall back to
 *   null (honest '—'), never fabricated values
 * - Side effects: none — pure function, original never mutated
 */
import type { OnchainPoolListItem } from './onchain-pool-discovery'

type DynamicData = {
  volume24h?: string | null
  fees24h?: string | null
  totalLiquidity?: string | null
  aprItems?: unknown[]
}

type PoolLike = {
  address: string
  dynamicData?: DynamicData
}

/**
 * Merge onchain metrics for the pool's address over the static stub.
 * Laws:
 * - A metrics entry present → its values win (including honest nulls).
 * - No metrics entry → stub '0' values become null ('0' is a fabricated
 *   zero for onchain-only pools — unavailable is '—', never $0.00).
 * - Real (non-'0') values are never touched.
 */
export function mergeOnchainPoolMetrics(pool: PoolLike, enriched: OnchainPoolListItem[]): PoolLike {
  const address = pool.address?.toLowerCase()
  const entry = enriched.find(p => p.address.toLowerCase() === address)
  const stub = pool.dynamicData ?? {}

  const isStubZero = (value: string | null | undefined) => value === '0'

  const next: DynamicData = { ...stub }

  if (entry) {
    const dyn = (entry as unknown as { dynamicData?: DynamicData }).dynamicData

    if (dyn) {
      if (dyn.volume24h !== undefined) next.volume24h = dyn.volume24h
      if (dyn.fees24h !== undefined) next.fees24h = dyn.fees24h
      if (dyn.totalLiquidity !== undefined) next.totalLiquidity = dyn.totalLiquidity
      if (dyn.aprItems !== undefined) next.aprItems = dyn.aprItems
    }
  } else {
    // no metrics yet — stub zeros are fabricated zeros, honest form is null
    if (isStubZero(stub.volume24h)) next.volume24h = null
    if (isStubZero(stub.fees24h)) next.fees24h = null
  }

  return { ...pool, dynamicData: next }
}
