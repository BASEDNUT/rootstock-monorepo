import { expect, test } from '@playwright/test'

/*
  Rootstock surface: pools list renders from the baked registry
  (baked-pool-registry.json — rks-WETH-BAL on Base Sepolia).
*/
test('Rootstock: pools page renders with the baked-registry pool', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')
  await expect(page.getByRole('heading', { name: 'Liquidity pools' })).toBeVisible()

  // Baked pool row is served without any network dependency.
  // The table row renders token pills + version + type (pool-name display
  // mode off by default) — 'v3' + 'Weighted' uniquely identify the table row
  // (marketing band says 'Weighted pool' and carries no version tag).
  const row = page.getByRole('group').filter({ hasText: 'v3' }).filter({ hasText: 'Weighted' })
  await expect(row).toBeVisible()
})
