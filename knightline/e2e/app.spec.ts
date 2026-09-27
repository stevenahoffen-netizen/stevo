import { expect, test } from '@playwright/test'
import { cell, dailyFor, expectMoves, openOn, practice, tapRoute, tutorial } from './helpers'

const MONDAY = '2026-09-28' // puzzle #8, 5x5 easy
const monday = dailyFor(MONDAY)

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/fonts\.g|ERR_CERT|net::/.test(m.text())) errors.push(m.text())
  })
  ;(page as unknown as { __errors: string[] }).__errors = errors
})

test.afterEach(async ({ page }) => {
  expect((page as unknown as { __errors: string[] }).__errors).toEqual([])
})

test('first visit shows how to play, then today’s puzzle', async ({ page }) => {
  await openOn(page, MONDAY, '/', { skipIntro: false })
  await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Play today/ })).toBeFocused()
  await page.getByRole('button', { name: /Play today/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('No. 8')).toBeVisible()
  await expectMoves(page, 1, monday.solution.length)
  await expect(page.getByTestId('status')).toContainText('Start on 1')
  // the intro doesn't come back
  await page.reload()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('solving the daily shows the result and a spoiler-free share card', async ({ page }) => {
  await openOn(page, MONDAY)
  await tapRoute(page, monday.solution)
  await expect(page.getByTestId('status')).toContainText('Solved in')
  const dialog = page.getByRole('dialog', { name: 'No. 8 solved' })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  const share = await dialog.getByLabel('Share preview').textContent()
  expect(share).toContain('Knightline #8')
  expect(share).toContain('Mon 5×5')
  expect(share).toMatch(/0 backtracks · no hints/)
  expect(share).toMatch(/[🟩🟨🟥]{5}/u)
  expect(share).toMatch(/#r8(\.\d+){5}$/)
  await expect(dialog.getByText('1 day streak')).toBeVisible()
  // stats reflect the solve
  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Statistics' }).click()
  const stats = page.getByRole('dialog', { name: 'Statistics' })
  await expect(stats.locator('.tiles dd').first()).toHaveText('1')
})

test('illegal taps explain themselves; rewind, undo and restart work', async ({ page }) => {
  await openOn(page, MONDAY)
  const total = monday.solution.length
  // A non-knight square next to the start
  const start = monday.solution[0]
  const cols = monday.cols
  const neighbours = [start + 1, start - 1, start + cols, start - cols].filter(
    (c) => c >= 0 && c < monday.rows * cols && !monday.blocked.includes(c) && Math.abs((c % cols) - (start % cols)) <= 1,
  )
  await cell(page, neighbours[0]).click()
  await expect(page.getByRole('alert')).toContainText('Knights jump in an L')
  await expectMoves(page, 1, total)

  await tapRoute(page, monday.solution, 1, 6)
  await expectMoves(page, 6, total)
  await cell(page, monday.solution[2]).click() // rewind
  await expectMoves(page, 3, total)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expectMoves(page, 2, total)
  await page.getByRole('button', { name: 'Restart' }).click()
  await expectMoves(page, 1, total)
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled()
})

test('hints point to the next square, or to where the route went wrong', async ({ page }) => {
  await openOn(page, MONDAY)
  await page.getByRole('button', { name: 'Hint' }).click()
  await expect(cell(page, monday.solution[1])).toHaveClass(/hinted/)
  await expect(page.getByTestId('status')).toContainText('Try the highlighted square')

  // Take a legal but wrong first jump, if one exists.
  const legal = await page.locator('.piece.target').evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.cell)))
  const wrong = legal.find((c) => c !== monday.solution[1])
  test.skip(wrong === undefined, 'first move is forced on this puzzle')
  await cell(page, wrong!).click()
  await page.getByRole('button', { name: 'Hint' }).click()
  await expect(page.getByTestId('status')).toContainText('went off course')
  await page.getByRole('button', { name: 'Rewind there' }).click()
  await expectMoves(page, 1, monday.solution.length)
})

test('progress survives a reload', async ({ page }) => {
  await openOn(page, MONDAY)
  await tapRoute(page, monday.solution, 1, 5)
  await expectMoves(page, 5, monday.solution.length)
  await page.reload()
  await expectMoves(page, 5, monday.solution.length)
})

test('the tutorial walks through three lessons into the daily', async ({ page }) => {
  await openOn(page, MONDAY, '/', { skipIntro: false })
  await page.getByRole('button', { name: 'Quick tutorial' }).click()
  for (let i = 0; i < tutorial.length; i++) {
    await expect(page.locator('.coach-title')).toContainText(`Lesson ${i + 1} of 3`)
    await tapRoute(page, tutorial[i].solution)
    const dialog = page.getByRole('dialog', { name: 'Nicely done' })
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await dialog.getByRole('button', { name: i < tutorial.length - 1 ? 'Next lesson' : /Play today/ }).click()
  }
  await expect(page.getByText('No. 8')).toBeVisible()
})

test('a race link shows the ghost and the result', async ({ page }) => {
  await openOn(page, MONDAY, '/#r8.5.10.15.20.600')
  await expect(page.getByTestId('ghost')).toBeVisible()
  await tapRoute(page, monday.solution)
  const dialog = page.getByRole('dialog', { name: 'No. 8 solved' })
  await expect(dialog).toBeVisible({ timeout: 5000 })
  await expect(dialog).toContainText('You beat your friend’s 10:00')
})

test('archive and practice load other puzzles', async ({ page }) => {
  await openOn(page, MONDAY)
  await page.getByRole('button', { name: 'Archive and practice' }).click()
  const archive = page.getByRole('dialog', { name: 'Archive' })
  await archive.getByRole('button', { name: /#1\b/ }).click()
  await expect(page.getByText('No. 1')).toBeVisible()
  await expect(page.getByRole('button', { name: /Back to today/ })).toBeVisible()

  await page.getByRole('button', { name: 'Archive and practice' }).click()
  await page.getByRole('dialog', { name: 'Archive' }).getByRole('button', { name: /^6×6/ }).click()
  await expect(page.locator('.meta-title')).toHaveText('Practice')
  const first6 = practice['6'][0]
  await expectMoves(page, 1, first6.s.length)
})

test('settings: theme and exit counts', async ({ page }) => {
  await openOn(page, MONDAY)
  await page.getByRole('button', { name: 'Settings' }).click()
  const dlg = page.getByRole('dialog', { name: 'Settings' })
  await dlg.getByLabel('Dark').check()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await dlg.getByText('Show exit counts').click()
  await dlg.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator('.exits').first()).toBeVisible()
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(15, 19, 27)')
})
