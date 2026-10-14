/**
 * Pool metric display + ordering for nullable dynamic metrics.
 *
 * Onchain-sourced pools (baked registry + live discovery) have no analytics
 * pipeline — their volume24h / fees24h / totalLiquidity are null at the
 * data source, never a fabricated '0'. Rendering shows an em-dash for
 * unavailable metrics; a genuine '0' from an API-sourced pool still renders
 * as a number.
 */

export const UNAVAILABLE_METRIC_DISPLAY = '—'

/**
 * Format a nullable metric: null/undefined → em-dash; a real value
 * (including a genuine '0' from an API-sourced pool) formats through the
 * provided formatter.
 */
export function poolMetricDisplay(
  value: string | null | undefined,
  format: (v: string) => string
): string {
  if (value === null || value === undefined) return UNAVAILABLE_METRIC_DISPLAY
  return format(value)
}

/**
 * Descending totalLiquidity comparator that treats null TVL as
 * unavailable: nulls sort last, real values keep numeric order, two nulls
 * tie (stable).
 */
/** Minimal structural shape needed for TVL ordering — both API-sourced and onchain-sourced pools satisfy it. */
type PoolWithNullableTvl = { dynamicData?: { totalLiquidity?: string | null } | null }

export function compareByTotalLiquidityDesc(
  a: PoolWithNullableTvl,
  b: PoolWithNullableTvl
): number {
  const aTvl = a.dynamicData?.totalLiquidity
  const bTvl = b.dynamicData?.totalLiquidity

  if (aTvl === null || aTvl === undefined) {
    return bTvl === null || bTvl === undefined ? 0 : 1 // a sorts after b
  }

  if (bTvl === null || bTvl === undefined) return -1 // b sorts after a

  return Number(bTvl) - Number(aTvl)
}
