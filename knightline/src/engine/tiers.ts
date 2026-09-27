// The weekly difficulty curve used to generate daily puzzles.
// Index 0 = Monday ... 6 = Sunday.
//
// Difficulty is steered mainly by `bits`: how much real guessing a careful
// player faces along the route (choices that aren't immediately doomed; see
// playMetrics in path.ts). Board size and the logic level shape the feel.

import type { TierSpec } from './generate'

export const WEEKLY_TIERS: readonly TierSpec[] = [
  // Mon: gentle 5x5, one bonus number
  { tier: 'easy', rows: 5, cols: 5, holes: [0, 4], maxLevel: 2, extraWaypoints: 1, bits: [3, 7], maxWaypointFraction: 0.3, maxFirstChoices: 2, maxGiveaways: 2 },
  // Tue: 5x5 with more choices
  { tier: 'medium', rows: 5, cols: 5, holes: [0, 4], maxLevel: 3, maxL3: 4, extraWaypoints: 0, bits: [6, 10], maxWaypointFraction: 0.25, maxFirstChoices: 3, maxGiveaways: 1 },
  // Wed: 6x6, two bonus numbers
  { tier: 'easy', rows: 6, cols: 6, holes: [0, 4], maxLevel: 2, extraWaypoints: 2, bits: [6, 10], maxWaypointFraction: 0.34, maxFirstChoices: 2, maxGiveaways: 2 },
  // Thu: 6x6, minimal numbers
  { tier: 'medium', rows: 6, cols: 6, holes: [0, 4], maxLevel: 2, extraWaypoints: 0, bits: [9, 14], maxWaypointFraction: 0.25, maxFirstChoices: 3, maxGiveaways: 1 },
  // Fri: 6x6 with lookahead
  { tier: 'hard', rows: 6, cols: 6, holes: [0, 4], maxLevel: 3, maxL3: 10, extraWaypoints: 0, bits: [11, 17], maxWaypointFraction: 0.22, maxFirstChoices: 3, maxGiveaways: 1 },
  // Sat: 7x7, minimal numbers
  { tier: 'medium', rows: 7, cols: 7, holes: [3, 7], maxLevel: 2, extraWaypoints: 0, bits: [14, 20], maxWaypointFraction: 0.25, maxFirstChoices: 3, maxGiveaways: 1 },
  // Sun: 7x7 with lookahead
  { tier: 'hard', rows: 7, cols: 7, holes: [3, 7], maxLevel: 3, maxL3: 14, extraWaypoints: 0, bits: [18, 28], maxWaypointFraction: 0.22, maxFirstChoices: 3, maxGiveaways: 1 },
]

export const PRACTICE_TIERS: Record<'5' | '6' | '7', TierSpec> = {
  '5': { tier: 'medium', rows: 5, cols: 5, holes: [0, 4], maxLevel: 3, maxL3: 4, extraWaypoints: 0, bits: [4, 10], maxWaypointFraction: 0.3, maxFirstChoices: 3, maxGiveaways: 1 },
  '6': { tier: 'medium', rows: 6, cols: 6, holes: [0, 4], maxLevel: 3, maxL3: 6, extraWaypoints: 0, bits: [9, 16], maxWaypointFraction: 0.25, maxFirstChoices: 3, maxGiveaways: 1 },
  '7': { tier: 'hard', rows: 7, cols: 7, holes: [3, 7], maxLevel: 3, maxL3: 10, extraWaypoints: 0, bits: [15, 25], maxWaypointFraction: 0.25, maxFirstChoices: 3, maxGiveaways: 1 },
}

/** Tutorial boards. Candidates are filtered for teaching quality in scripts/generate-content.ts. */
export const TUTORIAL_TIERS: readonly TierSpec[] = [
  // Lesson 1 teaches the jump itself: forced moves and close ends are fine here.
  { tier: 'easy', rows: 3, cols: 4, holes: [0, 0], maxLevel: 2, extraWaypoints: 0, maxForcedRun: 1, allowCloseEnds: true },
  { tier: 'easy', rows: 4, cols: 5, holes: [0, 2], maxLevel: 2, extraWaypoints: 0 },
  // Lesson 3 blocks four squares so the route has to choose a corner while
  // wrong turns show up fast; an open 5x5 has too many choices.
  { tier: 'easy', rows: 5, cols: 5, holes: [4, 4], maxLevel: 2, extraWaypoints: 0, maxTwoJumpShare: 1 },
]
