import { impersonate } from '@/helpers/e2e.helpers'
import { assertAddLiquidityEnabled, button, checkbox, clickButton } from '@/helpers/user.helpers'
import { expect, test, Page } from '@playwright/test'
import { EIP5792_EMULATION_LS_KEY } from '@repo/lib/modules/web3/impersonation/customMock'
import { defaultAnvilAccount } from '@repo/lib/test/utils/wagmi/fork.helpers'

/*
  Covers the batched transaction flow (EIP-5792 wallet_sendCalls) end to end.

  The mock connector emulates an atomic-batching wallet (like an EIP-7702 upgraded
  EOA) when the EIP5792_EMULATION_LS_KEY localStorage flag is set before the app
  boots (see packages/lib/modules/web3/impersonation/customMock.ts). The app then:
    - detects the atomic capability (useEip5792AtomicCapability)
    - shows the "Token approval bundling" alert
    - submits approvals + action as a single wallet_sendCalls batch
      (useEip5792BatchSubmitter), which the emulator executes against the fork
*/
/*
  Live-verified against api-v3.balancer.fi (MAINNET, 2026-11-19): STABLE / protocolVersion 3 carrying
  the BOOSTED tag, isPaused=false, isInRecoveryMode=false, tokens waEthWETH + osETH — every token is
  funded by the fork balance helper (mainnetTokenBalances).

  The pool this spec used before (0x85b2b559…, Aave GHO/USDT/USDC) became isPaused + isInRecoveryMode
  during the Balancer winddown, which CORRECTLY disables the pool-detail "Add liquidity" button. The
  app was never wrong; the hardcoded pool decayed upstream.
*/
const liveBoostedPoolId = '0x57c23c58b1d8c3292c15becf07c62c5c52457a42'

test.describe('Boosted stable pool v3 - batched transactions', () => {
  test.beforeEach(async ({ page }) => {
    await enableEip5792Emulation(page)

    await page.goto(`http://localhost:3000/pools/ethereum/v3/${liveBoostedPoolId}`)
    await impersonate(page, defaultAnvilAccount)
    await expect(button(page, 'Connect')).not.toBeVisible()

    // Fail in seconds, with the blocked reason, if this pool decays upstream too
    await assertAddLiquidityEnabled(page)
  })

  test('add liquidity batches approval and action into a single call', async ({ page }) => {
    await clickButton(page, 'Add liquidity')
    await page.getByPlaceholder('0.00').nth(1).fill('100')

    await agreeToBoostedPoolRisks(page)
    await clickButton(page, 'Next')

    // The app detected an atomic-batching wallet and announces the bundled flow
    await expect(page.getByText('Token approval bundling')).toBeVisible()

    // No separate approve/sign steps: everything goes in one batched call
    await expect(page.getByRole('button', { name: /(Approve|Sign)/i })).toHaveCount(0)

    await clickButton(page, 'Add liquidity')

    await expect(page.getByText('Transaction confirmed')).toBeVisible()
  })
})

async function enableEip5792Emulation(page: Page) {
  await page.addInitScript(key => {
    window.localStorage.setItem(key, 'true')
  }, EIP5792_EMULATION_LS_KEY)
}

async function agreeToBoostedPoolRisks(page: Page) {
  const boostedPoolRiskCheckbox = await checkbox(
    page,
    /I accept the risks of interacting with this pool/i,
  )

  const boostedPoolAdditionRiskCheckbox = await checkbox(
    page,
    /^I accept that by adding tokens to this Boosted Pool/i,
  )

  await boostedPoolRiskCheckbox.click()
  await boostedPoolAdditionRiskCheckbox.click()
}
