import { expect, test } from '@playwright/test'

/*
  Rootstock surface: navigate to the baked-registry pool via the app's own
  link (no hardcoded upstream pool route).
*/
test('Rootstock: pool detail page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')

  // The table row renders token pills + version + type (pool-name display
  // mode off by default) — 'v3' + 'Weighted' uniquely identify the table row
  // (marketing band says 'Weighted pool' and carries no version tag).
  const row = page.getByRole('group').filter({ hasText: 'v3' }).filter({ hasText: 'Weighted' })
  await row.click()

  await expect(page).toHaveURL(/\/pools\/base-sepolia\/v3\//)
  await expect(page.getByRole('button', { name: 'Add liquidity' })).toBeVisible()
})
