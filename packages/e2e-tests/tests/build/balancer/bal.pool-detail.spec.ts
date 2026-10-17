import { expect, test } from '@playwright/test'

/*
  Rootstock surface: navigate to the baked-registry pool via the app's own
  link (no hardcoded upstream pool route).
*/
test('Rootstock: pool detail page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')

  // Rows render token pills (pool-name display mode off by default).
  // VVV + DIEM together uniquely identify the gtINF mainnet row — the
  // default pools view is Base mainnet (8 live RPT pools, registry baked
  // 2026-10-17); Base Sepolia stays selectable but is not preselected.
  const row = page.getByRole('group').filter({ hasText: 'VVV' }).filter({ hasText: 'DIEM' })
  await row.click()

  await expect(page).toHaveURL(/\/pools\/base\/v3\//)
  await expect(page.getByRole('button', { name: 'Add liquidity' })).toBeVisible()
})
