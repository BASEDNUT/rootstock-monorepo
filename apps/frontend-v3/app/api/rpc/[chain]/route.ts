import type { GqlChain } from '@repo/lib/shared/services/api/generated/graphql'
import {
  createForbiddenResponse,
  getAllowedOrigins,
  isAllowedOrigin,
} from '@repo/lib/shared/utils/internal-api/errors'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientKey,
  rateLimitedResponse,
} from '@repo/lib/shared/utils/internal-api/rate-limit'
import type { NextRequest } from 'next/server'
import { postRpcCall } from '@repo/lib/shared/utils/internal-api/rpc'

type Params = {
  params: Promise<{
    chain: string
  }>
}

export async function POST(request: NextRequest, props: Params) {
  const allowedOrigins = getAllowedOrigins()

  if (!isAllowedOrigin(request, allowedOrigins)) {
    return createForbiddenResponse()
  }

  const limit = checkRateLimit('rpc-proxy', getClientKey(request), RATE_LIMITS.rpcProxy)
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSec ?? 60)

  const params = await props.params
  const { chain } = params

  // Chain allowlist: this proxy exists for the Rootstock deployments
  // only. Unknown chains get a 404 — the proxy must never forward an
  // arbitrary chain to a third-party RPC provider.
  if (chain !== 'BASE' && chain !== 'BASESEP') {
    return new Response(null, { status: 404 })
  }

  // postRpcCall returns a Response directly (status and body preserved).
  // Re-wrapping through Response.json() once flattened upstream error
  // statuses into 200s — the 500 missing-key path must reach the client.
  return postRpcCall(request, chain as GqlChain)
}
