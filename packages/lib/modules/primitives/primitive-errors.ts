/**
 * Rootstock primitive factory error translation (S106, frontend-ux Rule 7).
 *
 * Selectors are keccak256(signature).slice(0,4) — verified 2026-09-28.
 * Users never see raw revert selectors.
 */

export const PRIMITIVE_ERROR_SELECTORS: Record<string, string> = {
  '0xc6a799b9': 'Supply must be greater than zero.',
  '0x82094c2b': 'Token name cannot be empty.',
  '0x86c1bcda': 'Token symbol cannot be empty.',
  '0x83b7845b': 'Underlying is not a contract — an ERC-20 address is required (BPTs included).',
  '0x73b0270a': 'Wrapper name cannot be empty.',
  '0x6619ad93': 'Wrapper symbol cannot be empty.',
}

export function parsePrimitiveError(e: unknown): string {
  const err = e as {
    data?: string
    cause?: { data?: string; shortMessage?: string }
    shortMessage?: string
    message?: string
  }

  const data = err?.data || err?.cause?.data

  if (data && data.length >= 10) {
    const msg = PRIMITIVE_ERROR_SELECTORS[data.slice(0, 10)]
    if (msg) return msg
  }

  return err?.cause?.shortMessage || err?.shortMessage || err?.message || 'Transaction failed'
}

/** True when the error is a wallet rejection (user dismissed the signing prompt). */
export function isWalletRejection(e: unknown): boolean {
  const msg = parsePrimitiveError(e).toLowerCase()
  return msg.includes('user rejected') || msg.includes('user denied')
}
