import dailiesJson from '../data/dailies.json'
import practiceJson from '../data/practice.json'
import tutorialJson from '../data/tutorial.json'
import { puzzleFromJSON, type Puzzle, type PuzzleJSON } from '../engine/puzzle'
import { EPOCH, addDays, daysBetween, formatDay, puzzleNumber, weekdayIndex } from '../data/schedule'

const dailies: Puzzle[] = (dailiesJson.puzzles as unknown as PuzzleJSON[]).map(puzzleFromJSON)
const practice = Object.fromEntries(
  Object.entries(practiceJson as unknown as Record<string, PuzzleJSON[]>).map(([k, v]) => [k, v.map(puzzleFromJSON)]),
) as Record<PracticeSize, Puzzle[]>
const tutorial: Puzzle[] = (tutorialJson as unknown as PuzzleJSON[]).map(puzzleFromJSON)

export type PracticeSize = '5' | '6' | '7'
export type Mode = 'daily' | 'practice' | 'tutorial'

export interface PlayTarget {
  mode: Mode
  puzzle: Puzzle
  /** daily: the calendar day it belongs to */
  day?: string
  /** daily: puzzle number */
  number?: number
  /** tutorial: step 0..2 */
  step?: number
}

export function today(): string {
  return formatDay(new Date())
}

export function dailyFor(day: string): PlayTarget {
  const n = daysBetween(EPOCH, day)
  // Past the bundled content: cycle so the app never runs dry.
  const idx = ((n % dailies.length) + dailies.length) % dailies.length
  return { mode: 'daily', puzzle: dailies[idx], day, number: puzzleNumber(day) }
}

/** Days with a daily, newest first, from today back to the epoch. */
export function archiveDays(until: string = today()): string[] {
  const n = Math.max(0, daysBetween(EPOCH, until))
  return Array.from({ length: n + 1 }, (_, i) => addDays(until, -i))
}

export function practicePool(size: PracticeSize): Puzzle[] {
  return practice[size]
}

export function tutorialPuzzle(step: number): PlayTarget {
  return { mode: 'tutorial', puzzle: tutorial[step], step }
}

export const TUTORIAL_STEPS = tutorial.length

export function dayOfWeek(day: string): number {
  return weekdayIndex(day)
}
