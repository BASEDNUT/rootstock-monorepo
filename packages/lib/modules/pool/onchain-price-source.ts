/**
 * Rootstock onchain price source — GT multi with bounded retry + last-good cache.
 *
 * Live-probed 2026-11-04 (S134d): GeckoTerminal serves a 24-address multi
 * call fine (200, 23/24 priced) but rate-limits the 5th rapid call with 429
 * and recovers after ~40s. The visitor hook refetches every 30s, walking
 * straight into that wall.
 *
 * The previous implementation returned {} on ANY non-200, which blanked the
 * whole chain price map — including majors GT prices correctly (WETH at
 * $2,425.47 verified individually). That is the "no price for WETH" symptom.
 *
 * Laws kept: never fabricate. A cached price is a REAL observation with a
 * timestamp, served only inside the TTL, never beyond it; a fresh observation
 * always beats a cached one.
 */
import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import { GqlChainValues } from '@repo/lib/shared/services/api/graphql-enums'

/** GT network id by chain. GT serves no testnets — BASESEP honestly has none. */
const GT_NETWORK: Partial<Record<GqlChain, string>> = {
  [GqlChainValues.Base]: 'base',
}

/** Default retry budget: 429/5xx only. Live-probed recovery is ~40s. */
const DEFAULT_RETRY_DELAYS_MS = [2_000, 6_000, 15_000]

/** How long a real observation may be served when the source is failing. */
export const PRICE_CACHE_TTL_MS = 5 * 60_000

type CacheEntry = { price: number; at: number }

/** chain → address → last real observation. */
const priceCache = new Map<string, Map<string, CacheEntry>>()

/** Test hook: drop every cached observation. */
export function resetTokenPriceCacheForTests(): void {
  priceCache.clear()
}

function cacheFor(chain: GqlChain): Map<string, CacheEntry> {
  let m = priceCache.get(chain)

  if (!m) {
    m = new Map()
    priceCache.set(chain, m)
  }

  return m
}

/** 429 and 5xx are transient walls worth a retry; 4xx is not. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface FetchTokenPricesOptions {
  /** Injectable clock (epoch ms) — tests need deterministic TTL math. */
  now?: number
  /** Override the retry backoff (tests pass zeros). */
  retryDelaysMs?: number[]
  /** Override the cache TTL. */
  ttlMs?: number
}

/**
 * Fetch USD prices for token addresses via GeckoTerminal multi-price.
 * Keyless, CORS-open (live-verified). Unknown chains → empty map.
 *
 * Never throws: a source failure degrades to the still-fresh cache, then to
 * an empty map. Unpriced tokens are simply absent — never zero, never guessed.
 */
export async function fetchTokenPrices(
  chain: GqlChain,
  addresses: string[],
  options: FetchTokenPricesOptions = {}
): Promise<Record<string, number>> {
  const network = GT_NETWORK[chain]
  if (!network || addresses.length === 0) return {}

  const now = options.now ?? Date.now()
  const delays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
  const ttl = options.ttlMs ?? PRICE_CACHE_TTL_MS
  const wanted = addresses.map(a => a.toLowerCase())

  // lowercase canonical form — checksummed addresses can miss on GT.
  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/multi/${wanted.join(',')}`

  let fresh: Record<string, number> | null = null

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(url)

      if (res.ok) {
        const json = (await res.json()) as {
          data?: { attributes: { address: string; price_usd?: string | null } }[]
        }

        fresh = {}
        const cache = cacheFor(chain)

        for (const token of json.data || []) {
          const address = token.attributes?.address?.toLowerCase()
          if (!address) continue

          const usd = Number(token.attributes?.price_usd)

          if (Number.isFinite(usd) && usd > 0) {
            fresh[address] = usd
            cache.set(address, { price: usd, at: now })
          }
        }

        break
      }

      if (!isRetryable(res.status)) break
    } catch {
      // network/CORS failure — same class as a transient wall
    }

    if (attempt < delays.length) await sleep(delays[attempt] ?? 0)
  }

  // Merge: fresh observations win; still-fresh cache fills gaps (a later 200
  // that drops a token must not erase a real observation we already have).
  const cache = cacheFor(chain)
  const merged: Record<string, number> = {}

  for (const address of wanted) {
    const freshPrice = fresh?.[address]

    if (freshPrice !== undefined) {
      merged[address] = freshPrice
      continue
    }

    const cached = cache.get(address)

    if (cached && now - cached.at <= ttl) merged[address] = cached.price
  }

  return merged
}
