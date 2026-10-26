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

/**
 * Client-side ordering for onchain-only pool lists (browser-verified defect
 * 2026-10-24): sort + minTvl state only fed the SKIPPED API query, so the
 * onchain list rendered registry order regardless of the clicked column sort.
 * Nulls/unavailable metrics sort LAST in both directions; empty sorting
 * state = honest default TVL desc; minTvl > 0 drops pools below the floor
 * AND null-TVL pools. Never mutates the input.
 */
export function sortOnchainPools<
  T extends {
    dynamicData?: {
      totalLiquidity?: string | null
      volume24h?: string | null
      aprItems?: { apr: number }[]
    } | null
  },
>(pools: T[], sorting: { id: string; desc: boolean }[], minTvl: number = 0): T[] {
  const floor = minTvl > 0 ? minTvl : 0

  const filtered =
    floor > 0
      ? pools.filter(p => {
          const tvl = p.dynamicData?.totalLiquidity
          return tvl !== null && tvl !== undefined && Number(tvl) >= floor
        })
      : [...pools]

  const sort = sorting[0]
  const id = sort?.id ?? 'totalLiquidity'
  const desc = sort ? sort.desc : true

  const metricOf = (pool: T): number | null => {
    const d = pool.dynamicData
    if (!d) return null

    if (id === 'totalLiquidity') {
      return d.totalLiquidity === null || d.totalLiquidity === undefined
        ? null
        : Number(d.totalLiquidity)
    }

    if (id === 'volume24h') {
      return d.volume24h === null || d.volume24h === undefined ? null : Number(d.volume24h)
    }

    if (id === 'apr') return totalApr(d.aprItems)
    return null
  }

  return filtered.sort((a, b) => {
    const av = metricOf(a)
    const bv = metricOf(b)
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return desc ? bv - av : av - bv
  })
}

/** Total APR = sum of aprItems; null when there are no items. */
export function totalApr(items: { apr: number }[] | undefined | null): number | null {
  if (!items || items.length === 0) return null
  return items.reduce((sum, item) => sum + (item.apr ?? 0), 0)
}

/**
 * Rootstock (2026-10-26): global list aggregates for the pools stats band.
 * Sums the SAME list the table renders — source-agnostic (onchain or API).
 * Laws: null metrics are skipped (understated-but-real); a fully-null
 * metric stays null (renders '—', never a fabricated 0); a genuine 0
 * contributes as a real value.
 */
export interface PoolListAggregateInput {
  dynamicData?: {
    totalLiquidity?: string | null
    volume24h?: string | null
    fees24h?: string | null
  } | null
}

export function aggregatePoolListMetrics<T extends PoolListAggregateInput>(
  pools: T[]
): {
  totalLiquidity: number | null
  volume24h: number | null
  fees24h: number | null
  poolCount: number
} {
  let totalLiquidity: number | null = null
  let volume24h: number | null = null
  let fees24h: number | null = null

  for (const pool of pools) {
    const dd = pool.dynamicData
    if (!dd) continue

    if (dd.totalLiquidity != null)
      {totalLiquidity = (totalLiquidity ?? 0) + Number(dd.totalLiquidity)}

    if (dd.volume24h != null) volume24h = (volume24h ?? 0) + Number(dd.volume24h)
    if (dd.fees24h != null) fees24h = (fees24h ?? 0) + Number(dd.fees24h)
  }

  return { totalLiquidity, volume24h, fees24h, poolCount: pools.length }
}
