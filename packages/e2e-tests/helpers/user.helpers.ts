import { Locator, Page } from '@playwright/test'

export async function clickButton(page: Page, text: string) {
  const regex = new RegExp('^' + text + '$', 'i')
  return page.getByRole('button', { name: regex }).click()
}

/*
  Fails fast when the pool-detail "Add liquidity" button is blocked, instead of letting Playwright
  spend the whole test timeout retrying a button that will never enable.

  The button's disabled state is a pure function of pool metadata (see getPoolAddBlockedReason in
  packages/lib/modules/pool/pool.helpers.ts: 'Paused pool' / 'Pool in recovery' / ...), and
  PoolHeader renders that exact reason in a Chakra tooltip, so surface it as the failure message.

  The dev harness reads LIVE Balancer API pool data, so a pool that decays upstream (winddown,
  incident, governance) silently disables this button and the spec dies on a 150s timeout with no
  cause. This guard turns that class of failure into a few seconds plus a readable reason.
*/
export async function assertAddLiquidityEnabled(page: Page, timeoutMs = 15000) {
  const addLiquidity = button(page, 'Add liquidity').first()
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await addLiquidity.isEnabled().catch(() => false)) return
    await page.waitForTimeout(250)
  }

  // Disabled: hover to render the tooltip that carries the blocking reason
  await addLiquidity.hover().catch(() => {})
  const tooltipText = await page
    .getByRole('tooltip')
    .first()
    .innerText({ timeout: 2000 })
    .catch(() => '')
  const reason = tooltipText.trim().replace(/\s+/g, ' ') || 'no tooltip reason rendered'

  throw new Error(
    `"Add liquidity" stayed disabled on ${page.url()} after ${timeoutMs}ms. ` +
      `Blocked reason from the pool header tooltip: ${reason}. ` +
      `This means the pool the spec navigated to no longer allows adds upstream ` +
      `(usually isPaused or isInRecoveryMode on the live Balancer API). ` +
      `Repoint the spec at a healthy pool; the app is behaving correctly.`,
  )
}

export async function forceClickButton(page: Page, text: string) {
  const regex = new RegExp('^' + text + '$', 'i')
  return page.getByRole('button', { name: regex }).click({ force: true })
}

export async function isButtonVisible(page: Page, text: string) {
  try {
    await button(page, text).waitFor({ timeout: 10000 })
  } catch (e) {}
  return button(page, text).isVisible()
}

export function button(page: Page, text: string) {
  const regex = new RegExp('^' + text + '$', 'i')
  return page.getByRole('button', { name: regex })
}

export async function clickLink(page: Page, text: string) {
  const regex = new RegExp('^' + text + '$', 'i')
  return page.getByRole('link', { name: regex }).click()
}

export async function clickRadio(page: Page, groupLabel: string, radioLabel: string, exact = true) {
  const pattern = exact ? `^${radioLabel}$` : `^${radioLabel}`
  const regex = new RegExp(pattern, 'i')
  return page.getByRole('radiogroup', { name: groupLabel }).getByText(regex).click()
}

export async function setSliderPercent(page: Page, percent: number, scope?: Locator) {
  const root = scope ?? page
  const slider = root.locator('.chakra-slider')
  const box = await slider.boundingBox()
  if (!box) throw new Error('Slider is not visible, cannot calculate click position')
  await slider.click({
    position: { x: (box.width * percent) / 100, y: box.height / 2 },
  })
}

export async function checkbox(page: Page, text: string | RegExp) {
  return page.locator('label', { hasText: text }).locator('.chakra-checkbox__control')
}

// reliable method for selecting pill buttons at top of token select modal
export async function selectPopularToken(page: Page, tokenSymbol: string) {
  await button(page, 'Select token').first().click()
  const modalHeader = page.getByText('Select a token')
  await modalHeader.waitFor({ state: 'visible' })
  const modal = page.getByRole('dialog').filter({ has: modalHeader })
  await modal
    .getByRole('group')
    .filter({ has: page.getByText(tokenSymbol, { exact: true }) })
    .first()
    .click()
}
