import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import type { GqlTokenPrice } from '@repo/lib/shared/services/api/graphql-derived-types'

/**
 * B2a (live-caught 2026-10-21): onchain-only networks are excluded from
 * GetTokenPrices (the API's supportedNetworks), so priceFor() returned 0
 * for every Rootstock pool token — detail-page TVL $0.00, composition
 * price cells '—', 'From 0 Liquidity Providers', LP token price $0.00.
 * GeckoTerminal multi-price is the onchain-only price source (keyless,
 * CORS-open, live-verified; carries all Rootstock pool tokens).
 */

/** GT network ids by chain — ONLY chains the price API does not serve. */
export const GT_NETWORK_IDS: Partial<Record<GqlChain, string>> = {
  BASE: 'base',
}

/**
 * Merge GT prices into the API price list as GqlTokenPrice-shaped entries.
 * API entries WIN (API stays the source of truth where it serves a chain);
 * GT only fills onchain-only gaps. Non-finite / non-positive prices are
 * skipped — never fabricate.
 */
export function mergeOnchainTokenPrices(
  apiPrices: GqlTokenPrice[],
  gtPrices: Record<string, string | number>,
  chain: GqlChain
): GqlTokenPrice[] {
  const out: GqlTokenPrice[] = [...apiPrices]
  const known = new Set(apiPrices.map(p => p.address.toLowerCase()))

  for (const [address, raw] of Object.entries(gtPrices)) {
    const key = address.toLowerCase()
    if (known.has(key)) continue

    const price = Number(raw)
    if (!Number.isFinite(price) || price <= 0) continue

    out.push({
      __typename: 'GqlTokenPrice',
      address: key,
      chain,
      price,
      updatedAt: Math.floor(Date.now() / 1000),
    })
  }

  return out
}

/**
 * Fetch USD prices via GeckoTerminal multi-price (the onchain-only price
 * source). Keyless, CORS-open (live-verified 2026-10-21). Unknown chains
 * and network errors return {} — never fabricate.
 */
export async function fetchGtTokenPrices(
  chain: GqlChain,
  addresses: string[]
): Promise<Record<string, string>> {
  const network = GT_NETWORK_IDS[chain]
  if (!network || addresses.length === 0) return {}

  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/tokens/multi/${addresses
    .map(a => a.toLowerCase())
    .join(',')}`

  try {
    const res = await fetch(url)
    if (!res.ok) return {}

    const json = (await res.json()) as {
      data?: { attributes: { address: string; price_usd?: string } }[]
    }

    const out: Record<string, string> = {}
    for (const token of json.data || []) {
      const usd = token.attributes?.price_usd
      if (typeof usd === 'string' && usd.length > 0) {
        out[token.attributes.address.toLowerCase()] = usd
      }
    }
    return out
  } catch {
    return {}
  }
}
