import { chromium } from '@playwright/test'

const browser = await chromium.launch()

async function geometry(page, label) {
  const g = await page.evaluate(() => {
    const de = document.documentElement
    const b = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Build')
    const nav = b ? b.closest('nav') || b.closest('[role="navigation"]') : null
    const navRect = nav ? nav.getBoundingClientRect() : null
    const bRect = b ? b.getBoundingClientRect() : null
    let scrollParent = null
    if (b) {
      let p = b.parentElement
      while (p) {
        const s = getComputedStyle(p)
        if (/(auto|scroll)/.test(s.overflow + s.overflowY)) { scrollParent = { tag: p.tagName, cls: (p.className||'').toString().slice(0,60), scrollH: p.scrollHeight, clientH: p.clientHeight }; break }
        p = p.parentElement
      }
    }
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      docScrollW: de.scrollWidth, docClientW: de.clientWidth,
      docScrollH: de.scrollHeight, docClientH: de.clientHeight,
      navRect: navRect ? { x: +navRect.x.toFixed(1), y: +navRect.y.toFixed(1), w: +navRect.width.toFixed(1), h: +navRect.height.toFixed(1), position: nav ? getComputedStyle(nav).position : null } : null,
      buildRect: bRect ? { x: +bRect.x.toFixed(1), y: +bRect.y.toFixed(1), w: +bRect.width.toFixed(1), h: +bRect.height.toFixed(1) } : null,
      buildInViewport: bRect ? (bRect.x >= 0 && bRect.y >= 0 && bRect.x + bRect.width <= window.innerWidth && bRect.y + bRect.height <= window.innerHeight) : null,
      scrollParent,
    }
  })
  console.log(`[${label}]`, JSON.stringify(g))
  return g
}

// Phase A: steady state at 1280x2400
const pageA = await browser.newPage({ viewport: { width: 1280, height: 2400 } })
await pageA.goto('http://localhost:3000/create', { waitUntil: 'load', timeout: 90000 })
await pageA.waitForTimeout(6000)
await geometry(pageA, 'A steady 1280x2400')
const boxA = await pageA.getByText('Build', { exact: true }).first().boundingBox().catch(() => null)
console.log('[A] playwright boundingBox:', JSON.stringify(boxA))
await pageA.close()

// Phase B: exact CI sequence — 1280x720 -> goto -> resize 1280x2400 -> immediate force click
const pageB = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await pageB.goto('http://localhost:3000/create', { waitUntil: 'load', timeout: 90000 })
await pageB.waitForTimeout(4000)
await geometry(pageB, 'B pre-resize 1280x720')
await pageB.setViewportSize({ width: 1280, height: 2400 })
await geometry(pageB, 'B post-resize immediate')
try {
  await pageB.getByText('Build', { exact: true }).click({ force: true, timeout: 8000 })
  console.log('[B] CLICK OK')
} catch (e) {
  console.log('[B] CLICK FAIL:', e.message.split('\n')[0])
  await geometry(pageB, 'B post-fail')
}
await pageB.close()
await browser.close()
