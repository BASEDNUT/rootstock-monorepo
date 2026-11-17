/**
 * Seed prices — the THIRD price tier (Boss cache doctrine 2026-11-17).
 *
 * The live GeckoTerminal multi call is rate-walled and, when the wall
 * outlives the session cache, pool TVL renders '—'. IRIS already keeps a
 * 15-minute-refreshed price per token; the exporter bakes that plane into
 * the registry as `seedPrices` at build time.
 *
 * Tier order, highest first:
 *   1. API prices (authoritative where the API serves the chain)
 *   2. GeckoTerminal live + 5-min session cache
 *   3. THIS MODULE — the baked seed snapshot
 *
 * Laws:
 * - A seed price is a SNAPSHOT, never a quote. It only fills a gap; it never
 *   overrides a live observation.
 * - The bake enforces a 1-hour age cap at export time. This module RE-ENFORCES
 *   it at read time: a registry that sat on disk gets older, and a stale seed
 *   must degrade to 'no price' exactly like a missing one. Rendered as current
 *   TVL, a 53-hour-old price is the same lie-class as a fabricated $0.00.
 * - A seed entry with no price, a non-finite price, or a price <= 0 is absent.
 *   Never 0, never a neighbour's value.
 */

import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'

/** Mirror of the exporter's SEED_PRICES_MAX_AGE_SECONDS. */
export const SEED_PRICE_MAX_AGE_SECONDS = 3600

/** One baked seed entry as the exporter emits it. */
export type SeedPriceEntry = {
  price_usd: number | null
  source: string | null
  cached_at: number | null
}

export type SeedPricesBlock = {
  source?: string
  producer?: string
  cadenceSeconds?: number
  maxAgeSeconds?: number
  count?: { tokens: number; priced: number; unpriced: number; stale?: number }
  tokens?: Record<string, SeedPriceEntry>
  excluded?: unknown[]
}

/** Where a resolved price came from — lets a consumer avoid claiming freshness. */
export type PriceTier = 'live' | 'seed' | 'none'

export interface SeedPriceOptions {
  /** Injectable clock (epoch seconds) — tests pin the age boundary. */
  nowMs?: number
  /** Override the age cap. */
  maxAgeSeconds?: number
}

/**
 * Resolve seed prices for the requested addresses on a chain.
 *
 * Returns only usable prices: a finite value > 0 with a cached_at inside the
 * age cap. Everything else is omitted (absence, not a zero).
 *
 * BASE only — the bake carries the Rootstock/Base registry; other chains have
 * no seed plane and must not borrow one.
 */
export function getSeedTokenPrices(
  chain: GqlChain,
  addresses: string[],
  block: SeedPricesBlock | undefined,
  options: SeedPriceOptions = {}
): Record<string, string> {
  if (chain !== 'BASE') return {}

  const tokens = block?.tokens
  if (!tokens || addresses.length === 0) return {}

  const nowMs = options.nowMs ?? Date.now()
  const maxAge = options.maxAgeSeconds ?? SEED_PRICE_MAX_AGE_SECONDS
  const nowSeconds = nowMs / 1000

  const out: Record<string, string> = {}

  for (const address of addresses) {
    const key = address.toLowerCase()
    const entry = tokens[key]
    if (!entry) continue

    const price = entry.price_usd
    const cachedAt = entry.cached_at

    if (price === null || cachedAt === null) continue
    if (!Number.isFinite(price) || price <= 0) continue
    if (!Number.isFinite(cachedAt)) continue
    if (nowSeconds - cachedAt > maxAge) continue

    out[key] = String(price)
  }

  return out
}

/**
 * Tier for one address, given the three sources. Precedence is explicit so a
 * consumer can label a seed-derived number instead of presenting it as live.
 */
export function priceTierFor(
  address: string,
  live: Record<string, string | number | undefined>,
  seed: Record<string, string | number | undefined>
): PriceTier {
  const key = address.toLowerCase()
  if (live[key] !== undefined && Number(live[key]) > 0) return 'live'
  if (seed[key] !== undefined && Number(seed[key]) > 0) return 'seed'
  return 'none'
}
