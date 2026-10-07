import { http, HttpResponse } from 'msw'

/*
  JSON-RPC stubs for public RPCs used by app transports (e.g. sepolia.base.org).
  Unit specs that mount wagmi providers can fire real eth_blockNumber/eth_chainId
  polls through ChainConfig fallbacks. Without a handler, msw passes through to
  the live network, leaving TLS sockets mid-write at teardown — vitest then
  surfaces unhandled `write ECANCELED ... SSL destruction` errors and fails the
  CI job even when every test passes. Answer benign polls from memory; anything
  else fails cleanly with a JSON-RPC error. Specs needing chain data mock viem
  clients or use the 127.0.0.1 anvil URLs (stubbed below).
*/
const rpcStub = http.post('https://sepolia.base.org/', async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { id?: number; method?: string } | null
  const id = body?.id ?? 1

  if (body?.method === 'eth_blockNumber') {
    return HttpResponse.json({ jsonrpc: '2.0', id, result: '0x2d2fbe9' })
  }

  if (body?.method === 'eth_chainId') {
    // Base Sepolia (84532)
    return HttpResponse.json({ jsonrpc: '2.0', id, result: '0x14a34' })
  }

  return HttpResponse.json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: 'Method not found (unit-test RPC stub)' },
  })
})

const corsPreflightStub = http.options(
  'https://sepolia.base.org/*',
  () =>
    new HttpResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
)

export const defaultPostMswHandlers = [
  http.post('http://127.0.0.1:8*/*', () => {}),
  http.options('http://127.0.0.1:8*/*', () => new HttpResponse(null, { status: 204 })),
  http.get('/', () => {}),
  rpcStub,
  corsPreflightStub,
]
