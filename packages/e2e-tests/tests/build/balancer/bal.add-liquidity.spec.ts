import { expect, test } from '@playwright/test'

/*
  Rootstock surface: add-liquidity flow reachable from the baked-registry
  pool detail page (V3 weighted pool — proportional add supported).
*/
test('Rootstock: add liquidity page renders for the V3 pool', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')

  // Anchor on the pool id in the href: the baked registry holds 24 pools
  // and VVV + DIEM now matches TWO rows (iENG RECLAMM 0x4c6d.. and
  // gtINF WEIGHTED 0xc2b6..), so that text pair is no longer unique.
  // The id below is gtINF, the V3 weighted row these specs exercise.
  const row = page.locator('a[href*="/pools/base/v3/0xc2b6c664a224f046b16289c6ed3246b7547ff3cf"]')
  await row.click()

  await page.getByRole('button', { name: 'Add liquidity' }).click()

  await expect(page).toHaveURL(/\/pools\/base\/v3\/.+\/add-liquidity/)
  // Form renders token inputs (V3 weighted pools support proportional add).
  await expect(page.getByPlaceholder('0.00').first()).toBeVisible()
})
