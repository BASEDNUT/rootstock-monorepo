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

  // Anchor on the pool id in the href: the baked registry holds 24 pools
  // and VVV + DIEM now matches TWO rows (iENG RECLAMM 0x4c6d.. and
  // gtINF WEIGHTED 0xc2b6..), so that text pair is no longer unique.
  // The id below is gtINF, the V3 weighted row these specs exercise.
  const row = page.locator('a[href*="/pools/base/v3/0xc2b6c664a224f046b16289c6ed3246b7547ff3cf"]')
  await expect(row).toBeVisible()
})
