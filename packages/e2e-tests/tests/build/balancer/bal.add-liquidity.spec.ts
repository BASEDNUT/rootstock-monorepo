import { expect, test } from '@playwright/test'

/*
  Rootstock surface: add-liquidity flow reachable from the baked-registry
  pool detail page (V3 weighted pool — proportional add supported).
*/
test('Rootstock: add liquidity page renders for the V3 pool', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')

  // Rows render token pills (pool-name display mode off by default).
  // VVV + DIEM together uniquely identify the gtINF mainnet row — the
  // default pools view is Base mainnet (8 live RPT pools, registry baked
  // 2026-10-17); Base Sepolia stays selectable but is not preselected.
  const row = page.getByRole('group').filter({ hasText: 'VVV' }).filter({ hasText: 'DIEM' })
  await row.click()

  await page.getByRole('button', { name: 'Add liquidity' }).click()

  await expect(page).toHaveURL(/\/pools\/base\/v3\/.+\/add-liquidity/)
  // Form renders token inputs (V3 weighted pools support proportional add).
  await expect(page.getByPlaceholder('0.00').first()).toBeVisible()
})
