import { describe, expect, it } from 'vitest'
import { computeStreak } from './stats'
import {
  decodeChallenge,
  encodeChallenge,
  ghostProgress,
  paceEmoji,
  raceOutcome,
  shareText,
  splitThresholds,
} from './share'
import { formatTime, shortDate, squareLabel, squareName } from './format'
import { addDays } from '../data/schedule'

const run = (start: string, n: number) => Array.from({ length: n }, (_, i) => addDays(start, i))

describe('streaks', () => {
  it('counts consecutive days and keeps today alive', () => {
    expect(computeStreak(run('2026-10-01', 5), '2026-10-05').current).toBe(5)
    expect(computeStreak(run('2026-10-01', 5), '2026-10-06').current).toBe(5)
  })

  it('spends the starting freeze on one missed day', () => {
    const days = [...run('2026-10-01', 3), ...run('2026-10-05', 2)]
    const s = computeStreak(days, '2026-10-06')
    expect(s.current).toBe(5)
    expect(s.freezes).toBe(0)
    expect(s.frozen).toEqual(['2026-10-04'])
  })

  it('breaks when freezes run out', () => {
    const days = [...run('2026-10-01', 3), ...run('2026-10-07', 2)]
    const s = computeStreak(days, '2026-10-08')
    expect(s.current).toBe(2)
    expect(s.best).toBe(3)
  })

  it('earns freezes every 7 solves, max 2', () => {
    const s = computeStreak(run('2026-10-01', 21), '2026-10-21')
    expect(s.current).toBe(21)
    expect(s.freezes).toBe(2)
  })

  it('handles nothing solved', () => {
    expect(computeStreak([], '2026-10-01')).toEqual({ current: 0, best: 0, freezes: 1, frozen: [] })
  })
})

describe('challenge links', () => {
  it('round-trips', () => {
    const token = encodeChallenge(12, [21_000, 40_400, 95_000, 121_000, 134_000])
    expect(token).toBe('r12.21.40.95.121.134')
    expect(/^[A-Za-z0-9._~-]+$/.test(token)).toBe(true)
    expect(decodeChallenge('#' + token)).toEqual({ number: 12, splits: [21, 40, 95, 121, 134] })
  })

  it('rejects junk', () => {
    expect(decodeChallenge('#r12.1.2.3')).toBeNull()
    expect(decodeChallenge('#r12.5.4.3.2.1')).toBeNull()
    expect(decodeChallenge('#hello')).toBeNull()
    expect(decodeChallenge('#r3.0.0.0.0.0')).toBeNull()
  })

  it('interpolates ghost progress', () => {
    const ch = decodeChallenge('#r1.10.20.30.40.50')!
    expect(ghostProgress(ch, 0)).toBe(0)
    expect(ghostProgress(ch, 10_000)).toBeCloseTo(0.2)
    expect(ghostProgress(ch, 15_000)).toBeCloseTo(0.3)
    expect(ghostProgress(ch, 50_000)).toBeCloseTo(1)
    expect(ghostProgress(ch, 99_000)).toBe(1)
  })
})

describe('race verdicts', () => {
  const ch = decodeChallenge('#r8.20.41.60.80.100')!

  it('compares whole seconds, like the clock shows', () => {
    expect(raceOutcome(ch, 100_900)).toEqual({ kind: 'tie' })
    expect(raceOutcome(ch, 88_000)).toEqual({ kind: 'won', diffSec: 12 })
    expect(raceOutcome(ch, 105_500)).toEqual({ kind: 'lost', diffSec: 5 })
  })

  it('encodes a sub-second solve as a valid link', () => {
    const token = encodeChallenge(3, [100, 200, 300, 400, 500])
    expect(token).toBe('r3.0.0.0.0.1')
    expect(decodeChallenge(token)).not.toBeNull()
  })
})

describe('share text', () => {
  it('is spoiler-free and readable', () => {
    const text = shareText({
      label: 'Knightline #12 ♞ Fri 6×6',
      ms: 134_000, hints: 0, backtracks: 3,
      splitsMs: [21_000, 40_000, 95_000, 121_000, 134_000],
      url: 'https://example.com/#r12.21.40.95.121.134',
    })
    expect(text).toBe(
      'Knightline #12 ♞ Fri 6×6\n⏱ 2:14 · 3 backtracks · no hints\n🟩🟩🟥🟨🟩\nhttps://example.com/#r12.21.40.95.121.134',
    )
  })

  it('grades pace per fifth', () => {
    expect(paceEmoji([10, 20, 30, 40, 50])).toBe('🟨🟨🟨🟨🟨')
  })

  it('splits boards into fifths', () => {
    expect(splitThresholds(25)).toEqual([5, 10, 15, 20, 25])
    expect(splitThresholds(32)).toEqual([7, 13, 20, 26, 32])
  })
})

describe('labels', () => {
  it('names squares for screen readers and dates for the archive', () => {
    expect(squareLabel(0, 5, 5)).toBe('column A, row 5')
    expect(squareLabel(24, 5, 5)).toBe('column E, row 1')
    expect(shortDate('2026-09-27')).toBe('Sep 27')
  })
})

describe('formatting', () => {
  it('formats times and squares', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(134_000)).toBe('2:14')
    expect(formatTime(3_725_000)).toBe('1:02:05')
    expect(squareName(0, 5, 5)).toBe('a5')
    expect(squareName(24, 5, 5)).toBe('e1')
  })
})
