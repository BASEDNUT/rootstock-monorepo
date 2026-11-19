import { expect, test } from '@playwright/test'

/*
  Rootstock surface: navigate to the baked-registry pool via the app's own
  link (no hardcoded upstream pool route).
*/
test('Rootstock: pool detail page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/pools')

  // Anchor on the pool id in the href: the baked registry holds 24 pools
  // and VVV + DIEM now matches TWO rows (iENG RECLAMM 0x4c6d.. and
  // gtINF WEIGHTED 0xc2b6..), so that text pair is no longer unique.
  // The id below is gtINF, the V3 weighted row these specs exercise.
  const row = page.locator('a[href*="/pools/base/v3/0xc2b6c664a224f046b16289c6ed3246b7547ff3cf"]')
  await row.click()

  await expect(page).toHaveURL(/\/pools\/base\/v3\//)
  await expect(page.getByRole('button', { name: 'Add liquidity' })).toBeVisible()
})
