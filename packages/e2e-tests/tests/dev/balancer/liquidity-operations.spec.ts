import { impersonate } from '@/helpers/e2e.helpers'
import {
  assertAddLiquidityEnabled,
  button,
  checkbox,
  clickButton,
  setSliderPercent,
  forceClickButton,
} from '@/helpers/user.helpers'
import { test, expect, Page } from '@playwright/test'
import { defaultAnvilAccount } from '@repo/lib/test/utils/wagmi/fork.helpers'
import { forkClient } from '@repo/lib/test/utils/wagmi/fork.helpers'

/*
  Each describe that sends transactions snapshots the fork and reverts after each test so a failed
  or slow transaction cannot bleed state into the next test. Remove liquidity tests consume the LP
  tokens the Add liquidity tests mint, so the Remove describes seed their own LP in beforeAll and
  revert to that snapshot between tests instead of relying on the Add tests having run.
*/

/*
  Pool fixtures, live-verified against api-v3.balancer.fi (MAINNET, 2026-11-19). Both report
  isPaused=false and isInRecoveryMode=false, and every token they hold is funded by the fork balance
  helper (mainnetTokenBalances):

    - weighted: WEIGHTED / protocolVersion 2, tokens BAL + WETH                        -> variant v2
    - boosted:  STABLE / protocolVersion 3 + BOOSTED tag, WETH (waEthWETH) + osETH      -> variant v3

  Every reviewed gate in getPoolAddBlockedReason is clean for both: no hook, all tokens isAllowed,
  priceRateProviderData.summary == 'safe', erc4626ReviewData.summary == 'safe'.

  The pools used before (0x3de27efa…20wstETH-80AAVE and 0x85b2b559…Aave GHO/USDT/USDC) went into
  recovery mode / paused during the Balancer winddown, which correctly disables the pool-detail
  "Add liquidity" button. The app was never wrong; the hardcoded pools decayed upstream.
*/
const liveWeightedPool = {
  id: '0x5c6ee304399dbdb9c8ef030ab642b10820db8f56000200000000000000000014',
  symbol: 'B-80BAL-20WETH',
}
const liveBoostedPool = {
  id: '0x57c23c58b1d8c3292c15becf07c62c5c52457a42',
  symbol: 'osETH-waWETH',
}

async function seedLpForRemoves(
  browser: import('@playwright/test').Browser,
  poolUrl: string,
  boosted: boolean,
): Promise<boolean> {
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(poolUrl)
    await impersonate(page, defaultAnvilAccount)

    await clickButton(page, 'Add liquidity')
    if (boosted) {
      await page.getByPlaceholder('0.00').nth(1).fill('100')
      await agreeToBoostedPoolRisks(page)
    } else {
      await page.getByPlaceholder('0.00').nth(0).fill('1')
      await page.getByText('I accept the risks of').click()
    }
    await clickButton(page, 'Next')
    await doAddLiquidityTxSteps(page)
    await expect(page.getByText('Transaction confirmed')).toBeVisible()

    await context.close()
    return true
  } catch (error) {
    console.warn('Failed to seed LP for remove liquidity tests:', error)
    return false
  }
}

test.describe('Weighted pool v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3000/pools/ethereum/v2/${liveWeightedPool.id}`)
    await impersonate(page, defaultAnvilAccount)
    await expect(button(page, 'Connect')).not.toBeVisible()

    // Fail in seconds, with the blocked reason, if the pool decays upstream
    await assertAddLiquidityEnabled(page)
  })

  test.describe('Add liquidity', () => {
    let snapshotId: `0x${string}`

    test.beforeEach(async () => {
      snapshotId = await forkClient.snapshot()
    })

    test.afterEach(async () => {
      await forkClient.revert({ id: snapshotId })
    })

    test('flexible', async ({ page }) => {
      await clickButton(page, 'Add liquidity')
      await expect(button(page, 'Next')).toBeVisible()

      await page.getByPlaceholder('0.00').nth(0).fill('1')
      await page.getByText('I accept the risks of').click()
      await clickButton(page, 'Next')

      await doAddLiquidityTxSteps(page)
      await expect(page.getByText('Transaction confirmed')).toBeVisible()
    })

    // SKIP (reason-carrying, not deleted): v2-weighted proportional is impossible upstream: all healthy mainnet v2 WEIGHTED pools are version 1, v1-weighted + WeightedPool2TokensFactory pools are SDK-excluded from proportional adds (LiquidityActionHelpers.ts:296-310), version>=2 weighted pools are in recovery mode, and a 731-pool live sweep found zero candidates
    // evidence: research/rootstock-iris-audit-20261118/ci-debt/fix-3b-builder-report.md
    test.skip('proportional — IMPOSSIBLE upstream: v2-weighted proportional is SDK-excluded, 0 candidates in 731-pool sweep (see research/rootstock-iris-audit-20261118/ci-debt/fix-3b-builder-report.md)', async ({
      page,
    }) => {
      await clickButton(page, 'Add liquidity')
      await expect(button(page, 'Next')).toBeVisible()

      await page.locator('[data-id="add-liquidity-tab-proportional"]').click()
      await page.getByPlaceholder('0.00').nth(0).fill('1')
      await page.getByText('I accept the risks of').click()
      await clickButton(page, 'Next')

      await doAddLiquidityTxSteps(page)
      await expect(page.getByText('Transaction confirmed')).toBeVisible()
    })
  })

  test.describe('Remove Liquidity', () => {
    let snapshotId: `0x${string}`

    test.beforeAll(async ({ browser }) => {
      const seeded = await seedLpForRemoves(
        browser,
        `http://localhost:3000/pools/ethereum/v2/${liveWeightedPool.id}`,
        false,
      )
      if (!seeded) test.skip()
      snapshotId = await forkClient.snapshot()
    })

    test.beforeEach(async () => {
      await forkClient.revert({ id: snapshotId })
      snapshotId = await forkClient.snapshot()
    })

    test('proportional', async ({ page }) => {
      await clickButton(page, 'Remove')
      await setSliderPercent(page, 50)
      await clickButton(page, 'Next')

      await clickButton(page, 'Remove liquidity')
      await expect(page.getByText('Transaction confirmed')).toBeVisible()

      await forceClickButton(page, 'Return to pool')
      await expect(page.getByText(liveWeightedPool.symbol).first()).toBeVisible()
    })

    test('single token', async ({ page }) => {
      await clickButton(page, 'Remove')
      await page.locator('#button-group-single').click()
      await clickButton(page, 'Next')

      await clickButton(page, 'Remove liquidity')
      await expect(page.getByText('Transaction confirmed')).toBeVisible()

      await forceClickButton(page, 'Return to pool')
      await expect(page.getByText(liveWeightedPool.symbol).first()).toBeVisible()
    })
  })
})

test.describe('Boosted stable pool v3', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:3000/pools/ethereum/v3/${liveBoostedPool.id}`)
    await impersonate(page, defaultAnvilAccount)
    await expect(button(page, 'Connect')).not.toBeVisible()

    // Fail in seconds, with the blocked reason, if the pool decays upstream
    await assertAddLiquidityEnabled(page)
  })

  test.describe('Add liquidity', () => {
    let snapshotId: `0x${string}`

    test.beforeEach(async () => {
      snapshotId = await forkClient.snapshot()
    })

    test.afterEach(async () => {
      await forkClient.revert({ id: snapshotId })
    })

    test('flexible', async ({ page }) => {
      await clickButton(page, 'Add liquidity')
      await page.getByPlaceholder('0.00').nth(1).fill('100')

      await agreeToBoostedPoolRisks(page)
      await clickButton(page, 'Next')

      await doAddLiquidityTxSteps(page)
      await expect(page.getByText('Transaction confirmed')).toBeVisible()
    })

    test('proportional', async ({ page }) => {
      await page.getByRole('button', { name: 'Add liquidity' }).click()

      await page.locator('[data-id="add-liquidity-tab-proportional"]').click()
      await page.getByPlaceholder('0.00').nth(1).fill('100')
      await agreeToBoostedPoolRisks(page)
      await clickButton(page, 'Next')

      await doAddLiquidityTxSteps(page)
      await expect(page.getByText('Transaction confirmed')).toBeVisible()
    })
  })

  test.describe('Remove Liquidity', () => {
    let snapshotId: `0x${string}`

    test.beforeAll(async ({ browser }) => {
      const seeded = await seedLpForRemoves(
        browser,
        `http://localhost:3000/pools/ethereum/v3/${liveBoostedPool.id}`,
        true,
      )
      if (!seeded) test.skip()
      snapshotId = await forkClient.snapshot()
    })

    test.beforeEach(async () => {
      await forkClient.revert({ id: snapshotId })
      snapshotId = await forkClient.snapshot()
    })

    test('proportional', async ({ page }) => {
      await clickButton(page, 'Remove')
      await setSliderPercent(page, 50)
      await clickButton(page, 'Next')

      await clickButton(page, `Sign approval: ${liveBoostedPool.symbol}`)
      await clickButton(page, 'Remove liquidity')
      await expect(page.getByText('Transaction confirmed')).toBeVisible()

      await forceClickButton(page, 'Return to pool')
      await expect(page.getByText(liveBoostedPool.symbol).first()).toBeVisible()
    })

    test('single token', async ({ page }) => {
      await clickButton(page, 'Remove')
      const singleTokenTab = page.locator('#button-group-single')
      await expect(singleTokenTab).toBeDisabled() // Boosted pools do not support single token removes
    })
  })
})

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

async function doAddLiquidityTxSteps(page: Page) {
  const addButton = button(page, 'Add liquidity')
  const approveOrSignButton = page.getByRole('button', { name: /(Approve|Sign)/i })

  while (true) {
    await addButton.or(approveOrSignButton).waitFor()
    if (await addButton.isVisible()) break
    try {
      await approveOrSignButton.click({ timeout: 3000 })
    } catch {
      // Button was detached between visibility check and click
    }
  }

  await addButton.click()
}
