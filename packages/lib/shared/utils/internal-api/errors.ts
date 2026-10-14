import { NextRequest } from 'next/server'

export function getAllowedOrigins(): string[] {
  return [
    ...(process.env.NEXT_PRIVATE_ALLOWED_ORIGINS || '').split(','),
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
  ].filter(Boolean)
}

/**
 * Referer origin check — STRICT equality, not prefix matching.
 *
 * A startsWith(origin) comparison is prefix-spoofable: a referer like
 * https://evil-allowedorigin.com passes an allowlist entry of
 * https://allowedorigin.com. Instead: parse the referer URL and compare
 * url.origin === allowedOrigin exactly — scheme, host, and port must all
 * match. Both http/https forms pass only when the config lists them.
 * Missing or unparsable referer → false. This is a supplementary control,
 * not the primary CSRF defense.
 */
/** Structurally accepts NextRequest / plain Request (route handlers vary). */
export type RequestWithHeaders = {
  headers: { get: (name: string) => string | null }
}

export function isAllowedOrigin(
  request: NextRequest | RequestWithHeaders,
  allowedOrigins: string[]
): boolean {
  const referer = request.headers.get('referer')
  if (!referer) return false

  let refererOrigin: string

  try {
    refererOrigin = new URL(referer).origin
  } catch {
    return false
  }

  return allowedOrigins.some(origin => refererOrigin === origin)
}

export function createForbiddenResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'Forbidden: Access denied',
      code: -32000,
      message: 'Access denied',
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

export function createBadRequestResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), { status: 400 })
}
