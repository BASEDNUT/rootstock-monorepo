import { expect, test } from '@playwright/test'

/*
  Rootstock surface: chains law = Base + Base Sepolia only, pools served from
  the baked registry (baked-first law) — no upstream Ethereum pools exist here.
*/
test('Rootstock: landing page renders and launches the app', async ({ page }) => {
  await page.goto('http://localhost:3000/')
  await page.getByRole('link', { name: 'Launch app' }).click()

  await expect(page).toHaveURL(/swap/)
})
