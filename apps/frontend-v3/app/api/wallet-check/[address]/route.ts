import { checkAddressReputation } from '@repo/lib/shared/services/hypernative/checkAddressReputation'
import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
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

type Params = {
  params: Promise<{
    address: string
  }>
}

export async function GET(request: Request, props: Params) {
  const { address } = await props.params

  // The route carries operator screening credentials - the same
  // origin + budget laws as the paid RPC relay apply.
  if (!isAllowedOrigin(request, getAllowedOrigins())) {
    return createForbiddenResponse()
  }

  const limit = checkRateLimit('wallet-check', getClientKey(request), RATE_LIMITS.walletCheck)
  if (!limit.allowed) return rateLimitedResponse(limit.retryAfterSec ?? 60)

  if (!isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const hypernativeApiId = process.env.PRIVATE_HYPERNATIVE_API_ID
  const hypernativeApiSecret = process.env.PRIVATE_HYPERNATIVE_API_SECRET

  if (!hypernativeApiId || !hypernativeApiSecret) {
    // Fail-closed: unconfigured screening never authorizes. Advisory mode
    // (WALLET_SCREENING_MODE=advisory) returns an explicit degraded response
    // — a documented risk acceptance, never a silent pass.
    if (process.env.WALLET_SCREENING_MODE === 'advisory') {
      return NextResponse.json({
        isAuthorized: true,
        degraded: true,
        error: 'Wallet screening is not configured',
      })
    }

    return NextResponse.json(
      { isAuthorized: false, error: 'Wallet screening is not configured' },
      { status: 503 }
    )
  }

  return checkAddressReputation({
    address,
    hypernativeApiId,
    hypernativeApiSecret,
  })
}
