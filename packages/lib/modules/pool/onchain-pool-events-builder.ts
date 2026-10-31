/**
 * B2c client side: baked pool-activity events (raw amounts, from
 * generate-baked-pool-events.mjs) + registry token decimals + GT prices
 * → the GqlPoolEvent-minimal shape usePoolActivity consumes.
 *
 * Raw baked fields:
 *   ADD/REMOVE: { pool, tx, timestamp, block, type, userAddress, kind,
 *                totalSupply, amountsRaw: string[] }
 *   SWAP: { pool, tx, timestamp, block, type, userAddress, tokenIn,
 *           tokenOut, amountInRaw, amountOutRaw }
 */

export interface BakedPoolEvent {
  pool: string
  tx: string
  timestamp: number
  block: number
  /** Position of the log within its block (dedupe key part). */
  logIndex?: number
  type: 'ADD' | 'REMOVE' | 'SWAP'
  userAddress: string
  kind?: number
  totalSupply?: string
  amountsRaw?: string[]
  tokenIn?: string
  tokenOut?: string
  amountInRaw?: string
  amountOutRaw?: string
}

export interface BuildEventsInput {
  events: BakedPoolEvent[]
  poolId: string
  /** pool token addresses in registration order (aligns with amountsRaw) */
  poolTokens: string[]
  /** lowercase token address → decimals */
  decimals: Record<string, number>
  /** lowercase token address → USD price */
  prices: Record<string, number>
}

interface EventToken {
  address: string
  amount: string
  valueUSD: number
}

export interface BuiltAddRemoveEvent {
  timestamp: number
  tx: string
  userAddress: string
  tokens: EventToken[]
  valueUSD: number
}

export interface BuiltSwapEvent {
  timestamp: number
  tx: string
  userAddress: string
  tokenIn: EventToken
  tokenOut: EventToken
  valueUSD: number
}

export interface BuiltPoolEvents {
  adds: BuiltAddRemoveEvent[]
  removes: BuiltAddRemoveEvent[]
  swaps: BuiltSwapEvent[]
}

function fmtAmount(raw: bigint, d: number): string {
  const base = raw.toString().padStart(d + 1, '0')
  const int = base.slice(0, -d)
  let frac = base.slice(-d).replace(/0+$/, '')
  if (frac.length > 9) frac = frac.slice(0, 9)
  return int + (frac ? '.' + frac : '')
}

function mkToken(
  address: string,
  raw: bigint,
  decimals: Record<string, number>,
  prices: Record<string, number>
): EventToken {
  const key = address.toLowerCase()
  const d = decimals[key] ?? 18
  const price = prices[key] ?? 0
  return {
    address: key,
    amount: fmtAmount(raw, d),
    valueUSD: (Number(raw) / 10 ** d) * price,
  }
}

export function buildOnchainPoolEvents({
  events,
  poolId,
  poolTokens,
  decimals,
  prices,
}: BuildEventsInput): BuiltPoolEvents {
  const out: BuiltPoolEvents = { adds: [], removes: [], swaps: [] }
  const pool = poolId.toLowerCase()

  const poolEvents = events.filter(e => (e.pool || '').toLowerCase() === pool)

  for (const e of poolEvents) {
    if (e.type === 'ADD' || e.type === 'REMOVE') {
      const tokens = poolTokens.map((address, i) =>
        mkToken(address, BigInt(e.amountsRaw?.[i] ?? '0'), decimals, prices)
      )

      const built: BuiltAddRemoveEvent = {
        timestamp: e.timestamp,
        tx: e.tx,
        userAddress: e.userAddress,
        tokens,
        valueUSD: tokens.reduce((s, t) => s + t.valueUSD, 0),
      }

      if (e.type === 'ADD') out.adds.push(built)
      else out.removes.push(built)
    } else if (e.type === 'SWAP') {
      const tokenIn = mkToken(e.tokenIn ?? '0x0', BigInt(e.amountInRaw ?? '0'), decimals, prices)
      const tokenOut = mkToken(e.tokenOut ?? '0x0', BigInt(e.amountOutRaw ?? '0'), decimals, prices)

      out.swaps.push({
        timestamp: e.timestamp,
        tx: e.tx,
        userAddress: e.userAddress,
        tokenIn,
        tokenOut,
        valueUSD: Math.max(tokenIn.valueUSD, tokenOut.valueUSD),
      })
    }
  }

  out.adds.sort((a, b) => b.timestamp - a.timestamp)
  out.removes.sort((a, b) => b.timestamp - a.timestamp)
  out.swaps.sort((a, b) => b.timestamp - a.timestamp)

  return out
}

import type {
  GqlPoolAddRemoveEventV3,
  GqlPoolSwapEventV3,
} from '@repo/lib/shared/services/api/graphql-derived-types'

/**
 * GqlPoolEvent-minimal shape — feeds the existing usePoolActivity reduce
 * unchanged (same __typename discrimination it already consumes).
 */
export type GqlShapedOnchainEvent =
  | (Omit<GqlPoolAddRemoveEventV3, 'chain'> & { chain: string })
  | (Omit<GqlPoolSwapEventV3, 'chain'> & { chain: string })

/**
 * Baked raw events → GqlPoolEvent-shaped array (B2c) for pools the remote
 * API never serves. Filtered to poolId, decoded with per-token decimals,
 * valued with GT prices, newest-first.
 */
export function buildOnchainPoolEventsAsGqlEvents({
  events,
  poolId,
  poolTokens,
  decimals,
  prices,
  chain = 'BASE',
}: BuildEventsInput & { chain?: string }): GqlShapedOnchainEvent[] {
  const built = buildOnchainPoolEvents({ events, poolId, poolTokens, decimals, prices })

  const raw = events.filter(e => (e.pool || '').toLowerCase() === poolId.toLowerCase())
  const byKey = new Map(raw.map(e => [`${e.type}:${e.tx}`, e]))

  const out: GqlShapedOnchainEvent[] = []

  for (const add of built.adds) {
    const e = byKey.get(`ADD:${add.tx}`) as BakedPoolEvent | undefined

    out.push({
      __typename: 'GqlPoolAddRemoveEventV3',
      id: `onchain-${add.tx}-add`,
      poolId: poolId.toLowerCase(),
      chain,
      timestamp: add.timestamp,
      tx: add.tx,
      type: 'ADD',
      valueUSD: add.valueUSD,
      userAddress: add.userAddress,
      tokens: add.tokens,
      // passthrough (unused by the reduce but part of the type)
      kind: e?.kind,
      totalSupply: e?.totalSupply,
    } as unknown as GqlShapedOnchainEvent)
  }

  for (const rm of built.removes) {
    const e = byKey.get(`REMOVE:${rm.tx}`) as BakedPoolEvent | undefined

    out.push({
      __typename: 'GqlPoolAddRemoveEventV3',
      id: `onchain-${rm.tx}-remove`,
      poolId: poolId.toLowerCase(),
      chain,
      timestamp: rm.timestamp,
      tx: rm.tx,
      type: 'REMOVE',
      valueUSD: rm.valueUSD,
      userAddress: rm.userAddress,
      tokens: rm.tokens,
      kind: e?.kind,
      totalSupply: e?.totalSupply,
    } as unknown as GqlShapedOnchainEvent)
  }

  for (const sw of built.swaps) {
    out.push({
      __typename: 'GqlPoolSwapEventV3',
      id: `onchain-${sw.tx}-swap`,
      poolId: poolId.toLowerCase(),
      chain,
      timestamp: sw.timestamp,
      tx: sw.tx,
      type: 'SWAP',
      valueUSD: sw.valueUSD,
      userAddress: sw.userAddress,
      tokenIn: { address: sw.tokenIn.address, amount: sw.tokenIn.amount },
      tokenOut: { address: sw.tokenOut.address, amount: sw.tokenOut.amount },
    } as unknown as GqlShapedOnchainEvent)
  }

  out.sort((a, b) => b.timestamp - a.timestamp)
  return out
}
