/**
 * Rootstock derived USD prices — tokens GeckoTerminal does not price.
 *
 * Verified on-chain + live 2026-11-04 (S134d):
 *
 *  - wNUT (0xba5e…) is NOT ERC4626. convertToAssets / convertToShares /
 *    asset / totalAssets all revert. It is an OZ ERC20Wrapper: underlying()
 *    returns NUT, decimals 18, 1:1 by construction. Therefore
 *    price(wNUT) == price(NUT), exactly — no extrapolation, no constant.
 *
 *  - GT returns wNUT with price_usd = null and lists it as neither base nor
 *    quote in any of its 3 pools, so the pool endpoint cannot rescue it.
 *    The wrapper relationship is the only correct source.
 *
 *  - PIPS (0x3f23…) also has price_usd = null, but its PIPS/NUT pool does
 *    carry base_token_price_usd (0.000006284… live). Resolved by EXACT
 *    identity match on relationships.base_token / quote_token.
 *
 *  - kCORE is our own BPT: GT 404s it and lists no pool. It stays
 *    unpriced until its own TVL can price it — never guessed here.
 *
 * Laws: derive only from a real on-chain relationship or a real GT pool
 * price. A derived price is never invented, and never overwrites a price the
 * source already supplied.
 */
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/** GT network id by chain (mirrors the price source — GT serves no testnets). */
const GT_NETWORK: Partial<Record<GqlChain, string>> = {
  [GqlChainValues.Base]: 'base',
}

/**
 * 1:1 ERC20Wrapper relationships, verified on-chain 2026-11-04:
 * wrapper underlying() → underlying token. A wrapper is worth exactly its
 * underlying per unit; both sides are 18 decimals.
 */
export const WRAPPER_UNDERLYING: Record<string, string> = {
  // wNUT underlying() == NUT (probed live)
  '0xba5ed46e31f80daff307cbf60bd422a6f62e3dd3': '0xb8de15fb529d98c93c749de63c749d48d25a30df',
}

/** How long a pool-derived price may be reused. */
export const POOL_PRICE_CACHE_TTL_MS = 5 * 60_000

type CacheEntry = { price: number; at: number }

const poolPriceCache = new Map<string, CacheEntry>()

/** Test hook: drop every pool-derived observation. */
export function resetPoolPriceCacheForTests(): void {
  poolPriceCache.clear()
}

/**
 * Price every known wrapper at its underlying's price. Returns ONLY the
 * derived entries — the caller merges over what the source supplied.
 *
 * Skips a wrapper when the source already priced it (fresh beats derived),
 * and skips any wrapper whose underlying is unpriced or non-positive.
 */
export function deriveWrapperPrices(prices: Record<string, number>): Record<string, number> {
  const derived: Record<string, number> = {}

  for (const [wrapper, underlying] of Object.entries(WRAPPER_UNDERLYING)) {
    if (prices[wrapper] !== undefined) continue

    const anchor = prices[underlying]

    if (anchor === undefined || !Number.isFinite(anchor) || anchor <= 0) continue

    derived[wrapper] = anchor
  }

  return derived
}

/** One GT pool row, narrowed to the fields the identity match needs. */
export interface GtPoolRow {
  attributes: {
    base_token_price_usd?: string | null
    quote_token_price_usd?: string | null
    reserve_in_usd?: string | null
  }
  relationships?: {
    base_token?: { data?: { id?: string } }
    quote_token?: { data?: { id?: string } }
  }
}

/** 'base_0xabc…' → '0xabc…'. GT relationship ids carry a network prefix. */
function relationshipAddress(id: string | undefined): string | null {
  if (!id) return null
  const hex = id.includes('_') ? id.slice(id.indexOf('_') + 1) : id
  return hex.startsWith('0x') ? hex.toLowerCase() : null
}

/**
 * Pick a token's USD price out of GT pool rows by EXACT identity match.
 *
 * Prefers the deepest pool (highest reserve_in_usd) when the token appears in
 * several. Returns null when no row references the token with a usable price
 * — never a sibling's price, never an average.
 */
export function pickPoolPriceUsd(address: string, rows: GtPoolRow[]): number | null {
  const want = address.toLowerCase()

  const candidates: { price: number; depth: number }[] = []

  for (const row of rows) {
    const base = relationshipAddress(row.relationships?.base_token?.data?.id)
    const quote = relationshipAddress(row.relationships?.quote_token?.data?.id)

    let raw: string | null | undefined

    if (base === want) raw = row.attributes.base_token_price_usd
    else if (quote === want) raw = row.attributes.quote_token_price_usd
    else continue

    if (raw === null || raw === undefined) continue

    const price = Number(raw)

    if (!Number.isFinite(price) || price <= 0) continue

    const depth = Number(row.attributes.reserve_in_usd ?? 0)

    candidates.push({ price, depth: Number.isFinite(depth) ? depth : 0 })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.depth - a.depth)

  return candidates[0]!.price
}

async function priceFromPools(chain: GqlChain, address: string): Promise<number | null> {
  const network = GT_NETWORK[chain]
  if (!network) return null

  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${address.toLowerCase()}/pools?page=1`

  try {
    const res = await fetch(url)
    if (!res.ok) return null

    const json = (await res.json()) as { data?: GtPoolRow[] }

    return pickPoolPriceUsd(address, json.data || [])
  } catch {
    return null
  }
}

export interface AugmentPricesOptions {
  chain: GqlChain
  /** Every token the caller needs priced. */
  addresses: string[]
  /** Prices the primary source already resolved. */
  prices: Record<string, number>
  /** Injectable clock (epoch ms). */
  now?: number
  /** Override the pool-price cache TTL. */
  ttlMs?: number
}

/**
 * Fill prices the primary source could not resolve.
 *
 * Order: wrapper derivation first (free, exact, no network), then one GT pool
 * lookup per still-unpriced token. Anything still unresolved stays ABSENT so
 * the metrics layer reports null rather than a fabricated number.
 */
export async function augmentWithDerivedPrices({
  chain,
  addresses,
  prices,
  now = Date.now(),
  ttlMs = POOL_PRICE_CACHE_TTL_MS,
}: AugmentPricesOptions): Promise<Record<string, number>> {
  const out: Record<string, number> = { ...prices }

  const wanted = addresses.map(a => a.toLowerCase())

  // 1. wrappers — exact 1:1, no network
  const derivedWrappers = deriveWrapperPrices(out)

  for (const [address, price] of Object.entries(derivedWrappers)) {
    if (wanted.includes(address)) out[address] = price
  }

  // 2. GT pool lookups for whatever is still unpriced
  const missing = wanted.filter(address => out[address] === undefined)

  for (const address of missing) {
    const cached = poolPriceCache.get(address)

    if (cached && now - cached.at <= ttlMs) {
      out[address] = cached.price
      continue
    }

    const price = await priceFromPools(chain, address)

    if (price !== null) {
      poolPriceCache.set(address, { price, at: now })
      out[address] = price
    }
  }

  return out
}
