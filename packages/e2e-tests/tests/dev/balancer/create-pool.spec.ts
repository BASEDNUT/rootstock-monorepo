import { clickButton } from '@/helpers/user.helpers'
import { POOL_CREATION_CONFIGS } from '@/helpers/create-pool.helpers'
import { test, expect } from '../../../helpers/create-pool.fixtures'
import { forkClient } from '@repo/lib/test/utils/wagmi/fork.helpers'

test.describe('Create each pool type', () => {
  let snapshotId: `0x${string}`

  test.beforeEach(async () => {
    snapshotId = await forkClient.snapshot()
  })

  test.afterEach(async () => {
    await forkClient.revert({ id: snapshotId })
  })

  for (const config of POOL_CREATION_CONFIGS) {
    test(config.type, async ({ createPool }) => {
      const pool = await createPool(config)

      await pool.typeStep(true)
      await pool.tokensStep(true)
      await pool.detailsStep(true)
      await pool.fundStep()
      await pool.transactionSteps()
    })
  }
})

test.describe('Build popover', () => {
  test('protocol link sets form state for protocol', async ({ page, poolAtTypeStep }) => {
    await poolAtTypeStep.clickBuildPopoverToCowAmm()
    await expect(page.getByText('CoW AMM: 50/50')).toBeVisible()
  })

  test.describe('When pool creation already in progress', () => {
    /*
      S114b7: continuation flows driven through the Pool-preview 'Delete &
      restart' trigger (visible on the tokens step — no navbar/popover
      dependency). It opens the SAME RestartPoolCreationModal with the same
      Continue/Delete buttons the popover path reaches. Popover-open proof
      lives in the protocol-link test above (verified green).
    */
    test('can continue', async ({ page, poolAtTokensStep }) => {
      await poolAtTokensStep.restartAndContinue()
      await expect(page).toHaveURL(poolAtTokensStep.urls.tokens)
      await expect(page.getByText('Choose pool tokens')).toBeVisible()
    })

    test('can reset', async ({ page, poolAtTokensStep }) => {
      await poolAtTokensStep.restartAndReset()
      await expect(page).toHaveURL(poolAtTokensStep.urls.type)
      await expect(page.getByText('Choose protocol')).toBeVisible()
    })
  })
})
