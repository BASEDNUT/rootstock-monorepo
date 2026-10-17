import { expect, test } from '@playwright/test'

/*
  Rootstock surface: pools list renders from the baked registry.
  2026-10-17: default view = Base MAINNET — our 8 live RPT pools
  (baked-pool-registry-base.json; migrated from Balancer BPTs via Safe
  nonces 5-14). Base Sepolia stays selectable but is not preselected.
*/
test('Rootstock: pools page renders with the baked-registry pool', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')
  await expect(page.getByRole('heading', { name: 'Liquidity pools' })).toBeVisible()

  // Baked pool rows are served without any network dependency.
  // Default mainnet view carries the graft pools — gtINF (v3 Weighted,
  // VVV/wNUT/DIEM) uniquely identifies a mainnet RPT row.
  const row = page.getByRole('group').filter({ hasText: 'gtINF' })
  await expect(row).toBeVisible()
})
