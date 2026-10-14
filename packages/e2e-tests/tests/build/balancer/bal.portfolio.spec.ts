import { expect, test } from '@playwright/test'

/*
  Rootstock surface: portfolio copy is project-branded
  (My ROOTSTOCK liquidity), not upstream Balancer copy.
*/
test('Rootstock: portfolio page renders', async ({ page }) => {
  await page.goto('http://localhost:3000/portfolio')
  await expect(page.getByText('My ROOTSTOCK liquidity')).toBeVisible()
})
