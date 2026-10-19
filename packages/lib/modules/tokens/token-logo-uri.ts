/**
 * Canonical ROOTSTOCK token logo source: BASEDNUT/tokenAssets repo
 * (trustwallet layout, we own it — survives upstream winddown).
 *
 * Tokens without a folder in the repo simply keep logoURI '' — the UI
 * renders the symbol text pill as fallback (existing behavior).
 */
const TOKEN_ASSETS_BASE = 'https://raw.githubusercontent.com/BASEDNUT/tokenAssets/main/tokens'

/** Chain id → tokenAssets network folder. */
const CHAIN_FOLDERS: Record<number, string> = {
  8453: '8453',
  84532: '84532',
}

/** Logo URI for a token address on a chain — null when the chain has no repo folder. */
export function tokenAssetsLogoUri(chainId: number, address: string): string | null {
  const folder = CHAIN_FOLDERS[chainId]
  if (!folder) return null
  return `${TOKEN_ASSETS_BASE}/${folder}/${address.toLowerCase()}/logo-128.png`
}
