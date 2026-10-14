import { NextResponse } from 'next/server'
import { captureError, ensureError } from '../../utils/errors'
import { hours } from '../../utils/time'

type ReputationResponse = {
  data: Array<{ flags: string[]; address: string; recommendation: string }>
}

type Params = {
  address: string
  hypernativeApiId: string
  hypernativeApiSecret: string
}

/*
  To be called from wallet-check nextjs API route.

  Policy id - b178a9ce-e82c-4dfd-8de8-9fa59fa7d7df
  created by hypernative based on their understanding of the required rules (OFAC + Related to OFAC up to 3 hops away)

  Hypernative reputation docs:
  https://docs.hypernative.xyz/hypernative-product-docs/developers/hypernative-api/screener/address-reputation/get-address-reputation-1

  Failure policy (fail-closed by default):
  - WALLET_SCREENING_MODE unset or 'enforcing' (DEFAULT): a provider error
    returns HTTP 503 with error info — the caller fails closed; the wallet
    flow does not proceed on an unknown screening status. An HTTP error is
    honest (unreachable screening ≠ authorized wallet).
  - WALLET_SCREENING_MODE=advisory: a provider error returns HTTP 200 with
    an explicit degraded:true field — screening is unavailable and the
    response says so instead of silently claiming authorization. Documented
    degraded mode for deployments that accept that risk.
*/
export async function checkAddressReputation({
  address,
  hypernativeApiId,
  hypernativeApiSecret,
}: Params) {
  const advisoryMode = process.env.WALLET_SCREENING_MODE === 'advisory'

  try {
    const res = await fetch('https://api.hypernative.xyz/screener/reputation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': hypernativeApiId,
        'x-client-secret': hypernativeApiSecret,
      },
      body: JSON.stringify({
        addresses: [address],
        screenerPolicyId: 'b178a9ce-e82c-4dfd-8de8-9fa59fa7d7df',
      }),
      next: {
        revalidate: hours(12).toSecs(),
      },
    })

    if (!res.ok) {
      throw new Error('Failed to fetch reputation. Response status: ' + res.status)
    }

    const response: ReputationResponse = await res.json()
    const recommendation = response.data[0]?.recommendation

    if (!recommendation) {
      throw new Error('Invalid reputation response: ' + JSON.stringify(response.data))
    }

    const isAuthorized = recommendation !== 'Deny'

    return NextResponse.json({ isAuthorized })
  } catch (err) {
    const error = ensureError(err)

    captureError(error, { extra: { address } })

    // Fail-closed: an unreachable/failed screening provider NEVER returns
    // isAuthorized:true. Enforcing (default) → 503; advisory → 200 with an
    // explicit degraded flag.
    if (advisoryMode) {
      return NextResponse.json({
        isAuthorized: true,
        degraded: true,
        error: error.message,
      })
    }

    return NextResponse.json({ isAuthorized: false, error: error.message }, { status: 503 })
  }
}
