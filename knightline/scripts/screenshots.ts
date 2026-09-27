// Screenshots of the main screens on phone, small phone, tablet and desktop,
// light and dark, for visual review. Needs a preview server on :4174:
//   npx vite build && npx vite preview --port 4174 &
//   npx tsx scripts/screenshots.ts <out-dir>
import { chromium, devices, type Page } from '@playwright/test'
import { dailyFor, tutorial } from '../e2e/helpers'
import { doomedCells, legalTargets, makeGame } from '../src/engine/path'

const OUT = process.argv[2] ?? 'screenshots'
const BASE = 'http://localhost:4174/'

async function at(page: Page, day: string, hash = '', intro = false, theme?: string) {
  const [y, m, d] = day.split('-').map(Number)
  await page.clock.setFixedTime(new Date(y, m - 1, d, 12, 0, 0))
  await page.addInitScript(
    ([intro, theme]) => {
      if (!intro) localStorage.setItem('knightline:v1:seen-intro', 'true')
      if (theme) localStorage.setItem('knightline:v1:settings', JSON.stringify({ theme }))
    },
    [intro, theme] as const,
  )
  await page.goto(BASE + hash)
  await page.waitForTimeout(300)
}
const tap = async (page: Page, cells: number[]) => {
  for (const c of cells) await page.getByTestId(`cell-${c}`).click()
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
async function shot(name: string, ctxOpts: Parameters<typeof browser.newContext>[0], fn: (p: Page) => Promise<void>) {
  const ctx = await browser.newContext({ ...ctxOpts, ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  await fn(page)
  await page.waitForTimeout(450)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  await ctx.close()
}
const phone = devices['iPhone 13']
const MON = '2026-09-28'
const mon = dailyFor(MON)

await shot('01-welcome', phone, (p) => at(p, MON, '', true))
await shot('02-start', phone, (p) => at(p, MON))
await shot('03-midroute', phone, async (p) => {
  await at(p, MON)
  await tap(p, mon.solution.slice(1, 9))
})
await shot('04-deadend', phone, async (p) => {
  await at(p, MON)
  const g = makeGame(mon)
  for (let i = 0; i < mon.solution.length - 1; i++) {
    const r = mon.solution.slice(0, i + 1)
    const bad = legalTargets(g, r).find((t) => t !== mon.solution[i + 1] && doomedCells(g, [...r, t]).length)
    if (bad !== undefined) {
      await tap(p, [...r.slice(1), bad])
      break
    }
  }
})
await shot('05-error', phone, async (p) => {
  await at(p, MON)
  await tap(p, mon.solution.slice(1, 4))
  await p.getByTestId(`cell-${mon.solution[6]}`).click()
})
await shot('06-win', phone, async (p) => {
  await at(p, MON)
  await tap(p, mon.solution.slice(1))
  await p.waitForTimeout(1600)
})
const SUN = '2026-10-04'
const sun = dailyFor(SUN)
await shot('07-sunday-dark', { ...phone, colorScheme: 'dark' }, async (p) => {
  await at(p, SUN)
  await tap(p, sun.solution.slice(1, 12))
})
await shot('08-small-phone', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, async (p) => {
  await at(p, SUN)
  await tap(p, sun.solution.slice(1, 6))
})
await shot('09-desktop', { viewport: { width: 1280, height: 800 } }, async (p) => {
  await at(p, '2026-10-02')
})
await shot('10-tablet', { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, async (p) => {
  await at(p, SUN)
})
await shot('11-race', phone, (p) => at(p, MON, '#r8.20.41.60.80.100', true))
await shot('12-tutorial3', phone, async (p) => {
  await at(p, MON)
  await p.getByRole('button', { name: 'How to play' }).click()
  await p.getByRole('button', { name: 'Replay tutorial' }).click()
  for (let i = 0; i < 2; i++) {
    const t = tutorial[i]
    await tap(p, t.solution.slice(1))
    await p.waitForTimeout(1300)
    await p.getByRole('button', { name: 'Next lesson' }).click()
  }
})
await shot('13-settings-dark', { ...phone, colorScheme: 'dark' }, async (p) => {
  await at(p, MON)
  await p.getByRole('button', { name: 'Settings' }).click()
})
await shot('14-archive', phone, async (p) => {
  await at(p, '2026-10-06')
  await p.getByRole('button', { name: 'Archive and practice' }).click()
})
await shot('15-hint', phone, async (p) => {
  await at(p, MON)
  const g = makeGame(mon)
  const wrong = legalTargets(g, mon.solution.slice(0, 3)).find((t) => t !== mon.solution[3])
  await tap(p, mon.solution.slice(1, 3))
  if (wrong !== undefined) await tap(p, [wrong])
  await p.getByRole('button', { name: 'Hint' }).click()
})
await browser.close()
console.log('done')
