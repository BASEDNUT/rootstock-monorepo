import { expect, test } from '@playwright/test'

/*
  Rootstock surface: add-liquidity flow reachable from the baked-registry
  pool detail page (V3 weighted pool — proportional add supported).
*/
test('Rootstock: add liquidity page renders for the V3 pool', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')

  // The table row renders token pills + version + type (pool-name display
  // mode off by default) — 'v3' + 'Weighted' uniquely identify the table row
  // (marketing band says 'Weighted pool' and carries no version tag).
  const row = page.getByRole('group').filter({ hasText: 'v3' }).filter({ hasText: 'Weighted' })
  await row.click()

  await page.getByRole('button', { name: 'Add liquidity' }).click()

  await expect(page).toHaveURL(/\/pools\/base-sepolia\/v3\/.+\/add-liquidity/)
  // Form renders token inputs (V3 weighted pools support proportional add).
  await expect(page.getByPlaceholder('0.00').first()).toBeVisible()
})
