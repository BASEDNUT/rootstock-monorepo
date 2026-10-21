import { NextRequest } from 'next/server'
import type { GqlChain } from '../../services/api/generated/graphql'
import { drpcUrl, publicRpcByChain } from '../rpc'

const DRPC_KEY = process.env.NEXT_PRIVATE_DRPC_KEY || ''

/**
 * The proxy relays standard node JSON-RPC only. Admin/debug/trace namespaces
 * can burn provider quota or leak node internals — reject them.
 */
const ALLOWED_METHOD_PREFIXES = ['eth_', 'net_', 'web3_']

const MAX_BODY_BYTES = 1024 * 1024 // 1MB — generous for multicall batches

function methodOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const m = (body as { method?: unknown }).method
  return typeof m === 'string' ? m : undefined
}

export async function postRpcCall(request: NextRequest, chain: GqlChain): Promise<Response> {
  // Resolve upstream: the operator-funded DRPC relay when configured, else
  // the public CORS-verified RPC for the served chains. The app's own read
  // flows (initialize / add-liquidity build calls) must never hard-fail on
  // an optional integration key.
  const upstreamUrl = DRPC_KEY ? drpcUrl(chain, DRPC_KEY) : publicRpcByChain[chain]

  if (!upstreamUrl) {
    return new Response(JSON.stringify({ error: `No RPC upstream for chain: ${chain}` }), {
      status: 404,
    })
  }

  const rawBody = await request.text()

  if (rawBody.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'Request body too large' }), {
      status: 413,
    })
  }

  let rpcBody: unknown

  try {
    rpcBody = JSON.parse(rawBody)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const methods = Array.isArray(rpcBody) ? rpcBody.map(methodOf) : [methodOf(rpcBody)]

  if (methods.some(m => !m || !ALLOWED_METHOD_PREFIXES.some(p => m.startsWith(p)))) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 403 })
  }

  // Return the upstream Response directly — status and body pass through
  // unchanged. The caller must never re-wrap this through Response.json(),
  // which rebuilds a 200 and swallows upstream error statuses.
  return fetch(upstreamUrl, {
    method: 'POST',
    body: rawBody,
    next: {
      revalidate: 0,
    },
  })
}
