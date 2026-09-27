// Solve history and forgiving streaks.
//
// A streak counts consecutive days with the daily solved. You start with one
// freeze and earn another every 7 solved days (max 2 banked). A missed day
// spends a freeze instead of breaking the streak.

import { addDays, daysBetween } from '../data/schedule'
import { load, save } from './storage'

export interface SolveRecord {
  ms: number
  hints: number
  backtracks: number
  size: number
}

export interface History {
  /** daily solves by calendar day (solved on its own day or later via archive) */
  dailies: Record<string, SolveRecord & { onTime: boolean }>
  /** practice solves by puzzle id */
  practice: Record<string, SolveRecord>
}

const KEY = 'history'
export const MAX_FREEZES = 2
export const FREEZE_EVERY = 7

export function loadHistory(): History {
  const h = load<History>(KEY, { dailies: {}, practice: {} })
  return { dailies: h.dailies ?? {}, practice: h.practice ?? {} }
}

export function saveHistory(h: History): void {
  save(KEY, h)
}

export interface Streak {
  current: number
  best: number
  freezes: number
  /** days a freeze was spent on */
  frozen: string[]
}

/** `solvedDays`: days whose daily was solved on that same day. */
export function computeStreak(solvedDays: Iterable<string>, today: string): Streak {
  const solved = new Set(solvedDays)
  const sorted = [...solved].filter((d) => d <= today).sort()
  if (!sorted.length) return { current: 0, best: 0, freezes: 1, frozen: [] }
  let current = 0
  let best = 0
  let freezes = 1
  let sinceEarn = 0
  let frozen: string[] = []
  const span = daysBetween(sorted[0], today)
  for (let i = 0; i <= span; i++) {
    const day = addDays(sorted[0], i)
    if (solved.has(day)) {
      current++
      sinceEarn++
      if (sinceEarn >= FREEZE_EVERY) {
        freezes = Math.min(MAX_FREEZES, freezes + 1)
        sinceEarn = 0
      }
    } else if (day === today) {
      // today isn't over yet; the streak is still alive
    } else if (current > 0 && freezes > 0) {
      freezes--
      frozen.push(day)
    } else {
      current = 0
      sinceEarn = 0
      frozen = []
    }
    best = Math.max(best, current)
  }
  return { current, best, freezes, frozen }
}

export interface Summary {
  played: number
  dailySolved: number
  streak: Streak
  bySize: Record<number, { count: number; best: number; avg: number }>
}

export function summarize(h: History, today: string): Summary {
  const onTimeDays = Object.entries(h.dailies)
    .filter(([, r]) => r.onTime)
    .map(([d]) => d)
  const all: SolveRecord[] = [...Object.values(h.dailies), ...Object.values(h.practice)]
  const bySize: Summary['bySize'] = {}
  for (const r of all) {
    const s = (bySize[r.size] ??= { count: 0, best: Infinity, avg: 0 })
    s.avg = (s.avg * s.count + r.ms) / (s.count + 1)
    s.count++
    s.best = Math.min(s.best, r.ms)
  }
  return {
    played: all.length,
    dailySolved: Object.keys(h.dailies).length,
    streak: computeStreak(onTimeDays, today),
    bySize,
  }
}
