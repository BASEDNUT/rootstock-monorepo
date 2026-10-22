/**
 * B2c (live-caught 2026-10-21): pool-detail activity events for onchain-only
 * pools. The remote API never knows our pools — usePoolEvents returns empty
 * forever. Activity comes from the chain: Vault LiquidityAdded/
 * LiquidityRemoved/Swap events, decoded with per-token decimals into the
 * minimal GqlPoolEvent shape the activity table consumes.
 *
 * Event truth (frozen V3 IVaultEvents.sol + live-verified 2026-10-21):
 *   LiquidityAdded(address indexed pool, address indexed liquidityProvider,
 *     uint8 indexed kind, uint256 totalSupply, uint256[] amountsAddedRaw,
 *     uint256[] swapFeeAmountsRaw) — topic0 a26a52d8...
 *   LiquidityRemoved — identical shape — topic0 8ce0d53c...
 *   Swap(address indexed pool, IERC20 indexed tokenIn, IERC20 indexed
 *     tokenOut, uint256 amountIn, uint256 amountOut, uint256
 *     swapFeePercentage, uint256 swapFeeAmount) — topic0 0874b2d5...
 */

export const T_LIQUIDITY_ADDED =
  '0xa26a52d8d53702bba7f137907b8e1f99ff87f6d450144270ca25e72481cca871'
export const T_LIQUIDITY_REMOVED =
  '0x8ce0d53c0b010debc14b5e112019f61530364db7f9957ae0422dd17f4e95b870'
export const T_SWAP =
  '0x0874b2d545cb271cdbda4e093020c452328b24af12382ed62c4d00f5c26709db'

export interface OnchainAddRemoveEvent {
  __typename: 'GqlPoolAddRemoveEventV3'
  type: 'ADD' | 'REMOVE'
  pool: string
  block: number
  tx: string
  timestamp: number
  userAddress: string
  kind: number
  totalSupply: string
  tokens: { address: string; amount: string; valueUSD: number }[]
  valueUSD: number
}

export interface OnchainSwapEvent {
  __typename: 'GqlPoolSwapEventV3'
  type: 'SWAP'
  pool: string
  block: number
  tx: string
  timestamp: number
  tokenIn: { address: string; amount: string }
  tokenOut: { address: string; amount: string }
  valueUSD: number
}

export type OnchainPoolEvent = OnchainAddRemoveEvent | OnchainSwapEvent

export interface DecodeCtx {
  blockTimestamp: number
  /** lowercase token address → decimals */
  decimals: Record<string, number>
  /** pool token addresses in registration order (ADD/REMOVE amounts align) */
  poolTokens: string[]
  /** optional prices for USD values (lowercase address → USD) */
  prices?: Record<string, number>
}

function topicAddr(t: string): string {
  return '0x' + t.slice(-40).toLowerCase()
}

function words(data: string): string[] {
  const d = (data || '').slice(2)
  return Array.from({ length: Math.floor(d.length / 64) }, (_, i) => d.slice(i * 64, (i + 1) * 64))
}

/** Format a raw amount with the token's decimals (max 9 significant decimals, trimmed). */
function fmtAmount(raw: bigint, decimals: number | undefined): string {
  const d = decimals ?? 18
  const neg = raw < 0n
  const abs = neg ? -raw : raw
  const base = abs.toString().padStart(d + 1, '0')
  const int = base.slice(0, -d)
  let frac = base.slice(-d)
  frac = frac.replace(/0+$/, '')
  if (frac.length > 9) frac = frac.slice(0, 9)
  return (neg ? '-' : '') + int + (frac ? '.' + frac : '')
}

function usdFor(raw: bigint, decimals: number | undefined, price: number | undefined): number {
  if (!price) return 0
  const d = decimals ?? 18
  return Number(raw) / 10 ** d * price
}

/** Decode one Vault activity log; null for unknown/malformed — never throws. */
export function decodePoolEventLog(
  log: { blockNumber: string; transactionHash: string; topics: string[]; data: string } | null,
  ctx: DecodeCtx
): OnchainPoolEvent | null {
  if (!log || !Array.isArray(log.topics) || log.topics.length < 4) return null

  const t0 = log.topics[0]!
  const pool = topicAddr(log.topics[1]!)
  const block = parseInt(log.blockNumber, 16)
  const ts = ctx.blockTimestamp
  const tx = log.transactionHash

  if (t0 === T_LIQUIDITY_ADDED || t0 === T_LIQUIDITY_REMOVED) {
    const w = words(log.data || '')
    if (w.length < 3) return null
    const amountsOffset = Number(BigInt('0x' + w[1]))
    const amountsHead = Math.floor(amountsOffset / 32)
    if (amountsHead + 1 > w.length) return null
    const amountsLen = Number(BigInt('0x' + w[amountsHead]))
    const amounts: bigint[] = []
    for (let i = 0; i < amountsLen; i++) {
      const idx = amountsHead + 1 + i
      if (idx >= w.length) return null
      amounts.push(BigInt('0x' + w[idx]))
    }

    const tokens = ctx.poolTokens.map((address, i) => {
      const key = address.toLowerCase()
      const dec = ctx.decimals[key]
      const price = ctx.prices?.[key]
      const amount = fmtAmount(amounts[i] ?? 0n, dec)
      return {
        address: key,
        amount,
        valueUSD: usdFor(amounts[i] ?? 0n, dec, price),
      }
    })

    const valueUSD = tokens.reduce((s, t) => s + t.valueUSD, 0)

    return {
      __typename: 'GqlPoolAddRemoveEventV3',
      type: t0 === T_LIQUIDITY_ADDED ? 'ADD' : 'REMOVE',
      userAddress: topicAddr(log.topics[2]!),
      kind: Number(BigInt(log.topics[3]!)),
      totalSupply: BigInt('0x' + w[0]).toString(),
      timestamp: ts,
      tx,
      pool,
      block,
      tokens,
      valueUSD,
    }
  }

  if (t0 === T_SWAP) {
    const w = words(log.data || '')
    if (w.length < 4) return null

    const tokenIn = topicAddr(log.topics[2]!)
    const tokenOut = topicAddr(log.topics[3]!)
    const amountInRaw = BigInt('0x' + w[0])
    const amountOutRaw = BigInt('0x' + w[1])

    const mk = (addr: string, raw: bigint) => {
      const key = addr.toLowerCase()
      const dec = ctx.decimals[key]
      return {
        address: key,
        amount: fmtAmount(raw, dec),
        valueUSD: usdFor(raw, dec, ctx.prices?.[key]),
      }
    }

    const tokenInAmt = mk(tokenIn, amountInRaw)
    const tokenOutAmt = mk(tokenOut, amountOutRaw)

    return {
      __typename: 'GqlPoolSwapEventV3',
      timestamp: ts,
      tx,
      type: 'SWAP',
      pool,
      block,
      tokenIn: { address: tokenInAmt.address, amount: tokenInAmt.amount },
      tokenOut: { address: tokenOutAmt.address, amount: tokenOutAmt.amount },
      valueUSD: Math.max(tokenInAmt.valueUSD, tokenOutAmt.valueUSD),
    }
  }

  return null
}
