import { expect, type Page } from '@playwright/test'
import dailiesJson from '../src/data/dailies.json' with { type: 'json' }
import practiceJson from '../src/data/practice.json' with { type: 'json' }
import tutorialJson from '../src/data/tutorial.json' with { type: 'json' }
import { puzzleFromJSON, type Puzzle, type PuzzleJSON } from '../src/engine/puzzle'
import { daysBetween, EPOCH } from '../src/data/schedule'

export const dailies = (dailiesJson.puzzles as unknown as PuzzleJSON[]).map(puzzleFromJSON)
export const practice = practiceJson as unknown as Record<string, PuzzleJSON[]>
export const tutorial = (tutorialJson as unknown as PuzzleJSON[]).map(puzzleFromJSON)

export function dailyFor(day: string): Puzzle {
  return dailies[daysBetween(EPOCH, day)]
}

/** Pins the page clock to local noon on `day` so "today" is deterministic. */
export async function openOn(page: Page, day: string, path = '/', opts: { skipIntro?: boolean } = {}) {
  const [y, m, d] = day.split('-').map(Number)
  await page.clock.setFixedTime(new Date(y, m - 1, d, 12, 0, 0))
  if (opts.skipIntro !== false) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('knightline:v1:seen-intro', 'true')
      } catch {
        // ignore
      }
    })
  }
  await page.goto(path)
}

export const cell = (page: Page, c: number) => page.getByTestId(`cell-${c}`)

/** Taps the route from index `from` to `to` (exclusive). */
export async function tapRoute(page: Page, route: number[], from = 1, to = route.length) {
  for (let i = from; i < to; i++) await cell(page, route[i]).click()
}

export async function expectMoves(page: Page, n: number, total: number) {
  await expect(page.getByTestId('moves')).toHaveText(`Move ${n}/${total}`)
}
