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
  /** where progress is saved: the calendar day for dailies, else the puzzle id */
  sessionId: string
  /** daily: the calendar day it belongs to */
  day?: string
  /** daily: puzzle number */
  number?: number
  /** tutorial: step 0..2 */
  step?: number
  /** ignore saved progress and start over */
  fresh?: boolean
}

export function today(): string {
  return formatDay(new Date())
}

// Past the bundled content, cycle in whole weeks so each weekday keeps its
// difficulty (the epoch is a Monday).
const CYCLE = dailies.length - (dailies.length % 7)

export function dailyFor(day: string): PlayTarget {
  const n = daysBetween(EPOCH, day)
  const idx = n >= 0 && n < dailies.length ? n : ((n % CYCLE) + CYCLE) % CYCLE
  return { mode: 'daily', puzzle: dailies[idx], day, number: puzzleNumber(day), sessionId: `d-${day}` }
}

export function practiceTarget(puzzle: Puzzle, fresh = false): PlayTarget {
  return { mode: 'practice', puzzle, sessionId: puzzle.id, fresh }
}

/** Days with a daily, newest first, from today back to the epoch. */
export function archiveDays(until: string = today()): string[] {
  const n = Math.max(0, daysBetween(EPOCH, until))
  return Array.from({ length: n + 1 }, (_, i) => addDays(until, -i))
}

export function practicePool(size: PracticeSize): Puzzle[] {
  return practice[size]
}

/** Lessons always start from scratch. */
export function tutorialPuzzle(step: number): PlayTarget {
  return { mode: 'tutorial', puzzle: tutorial[step], step, sessionId: tutorial[step].id, fresh: true }
}

export const TUTORIAL_STEPS = tutorial.length

export function dayOfWeek(day: string): number {
  return weekdayIndex(day)
}
