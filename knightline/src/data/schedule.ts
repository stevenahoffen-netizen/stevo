// Daily schedule: puzzle #1 is EPOCH (a Monday). Local dates, like Wordle.

export const EPOCH = '2026-09-21'

/** Parses YYYY-MM-DD as a local-calendar date at noon (avoids DST edge cases). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function formatDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(day: string, n: number): string {
  const date = parseDay(day)
  date.setDate(date.getDate() + n)
  return formatDay(date)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86_400_000)
}

/** 1-based puzzle number for a date. */
export function puzzleNumber(day: string): number {
  return daysBetween(EPOCH, day) + 1
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayIndex(day: string): number {
  return (parseDay(day).getDay() + 6) % 7
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
