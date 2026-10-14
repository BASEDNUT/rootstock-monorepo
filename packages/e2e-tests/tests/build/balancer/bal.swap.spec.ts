import { expect, test } from '@playwright/test'

/*
  Rootstock surface: swap against our onchain-only chain (Base Sepolia) —
  no upstream API GraphQL response to wait for (onchain-only law: the remote
  API is never queried for our chains).
*/
test('Rootstock: swap page renders on Base Sepolia', async ({ page }) => {
  await page.goto('http://localhost:3000/swap/base-sepolia/ETH')

  await expect(page.getByRole('button', { name: 'ETH', exact: true })).toBeVisible()
})
