// The weekly difficulty curve used to generate daily puzzles.
// Index 0 = Monday ... 6 = Sunday.

import type { TierSpec } from './generate'

export const WEEKLY_TIERS: readonly TierSpec[] = [
  // Mon: gentle 5x5 with a bonus number
  { tier: 'easy', rows: 5, cols: 5, holes: [0, 4], maxLevel: 2, extraWaypoints: 1 },
  // Tue: 5x5 that needs a little lookahead
  { tier: 'medium', rows: 5, cols: 5, holes: [0, 4], maxLevel: 3, extraWaypoints: 0, minL3: 1, maxL3: 4 },
  // Wed: 6x6 with two bonus numbers
  { tier: 'easy', rows: 6, cols: 6, holes: [2, 4], maxLevel: 2, extraWaypoints: 2 },
  // Thu: 6x6, minimal numbers
  { tier: 'medium', rows: 6, cols: 6, holes: [2, 4], maxLevel: 2, extraWaypoints: 0 },
  // Fri: 6x6 with lookahead
  { tier: 'hard', rows: 6, cols: 6, holes: [2, 4], maxLevel: 3, extraWaypoints: 0, minL3: 2, maxL3: 8 },
  // Sat: 7x7, minimal numbers
  { tier: 'medium', rows: 7, cols: 7, holes: [3, 7], maxLevel: 2, extraWaypoints: 0 },
  // Sun: 7x7 with lookahead
  { tier: 'hard', rows: 7, cols: 7, holes: [3, 7], maxLevel: 3, extraWaypoints: 0, minL3: 3, maxL3: 12 },
]

export const PRACTICE_TIERS: Record<'5' | '6' | '7', TierSpec> = {
  '5': { tier: 'medium', rows: 5, cols: 5, holes: [0, 4], maxLevel: 3, extraWaypoints: 0, maxL3: 4 },
  '6': { tier: 'medium', rows: 6, cols: 6, holes: [2, 4], maxLevel: 3, extraWaypoints: 0, maxL3: 6 },
  '7': { tier: 'hard', rows: 7, cols: 7, holes: [3, 7], maxLevel: 3, extraWaypoints: 0, maxL3: 10 },
}

/** Tutorial puzzles: tiny boards, extra numbers, no lookahead. */
export const TUTORIAL_TIERS: readonly TierSpec[] = [
  { tier: 'easy', rows: 3, cols: 4, holes: [0, 0], maxLevel: 2, extraWaypoints: 0 },
  { tier: 'easy', rows: 4, cols: 5, holes: [0, 2], maxLevel: 2, extraWaypoints: 1 },
  { tier: 'easy', rows: 5, cols: 5, holes: [0, 1], maxLevel: 2, extraWaypoints: 1 },
]
