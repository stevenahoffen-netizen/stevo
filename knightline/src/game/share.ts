// Spoiler-free share text and ghost-race challenge links.
//
// A challenge travels in the URL hash as a plain token (letters, digits and
// dots only, so it survives sandboxed hosts): #r<number>.<s1>.<s2>.<s3>.<s4>.<s5>
// where s1..s5 are cumulative seconds at 20%, 40%, 60%, 80% and 100% of the route.

import { formatTime, plural } from './format'

export interface Challenge {
  number: number
  /** cumulative seconds at each fifth of the route */
  splits: [number, number, number, number, number]
}

/** Whole seconds, rounded down like the clock, so both players see the same time. */
export function toSeconds(ms: number): number {
  return Math.max(0, Math.floor(ms / 1000))
}

export function encodeChallenge(number: number, splitsMs: readonly number[]): string {
  const secs = splitsMs.map(toSeconds)
  // A valid link needs a positive finishing time.
  secs[4] = Math.max(1, secs[4])
  for (let i = 3; i >= 0; i--) secs[i] = Math.min(secs[i], secs[i + 1])
  return `r${number}.${secs.join('.')}`
}

export type RaceOutcome = { kind: 'won' | 'lost'; diffSec: number } | { kind: 'tie' }

export function raceOutcome(ch: Challenge, myMs: number): RaceOutcome {
  const mine = toSeconds(myMs)
  const theirs = ch.splits[4]
  if (mine === theirs) return { kind: 'tie' }
  return mine < theirs ? { kind: 'won', diffSec: theirs - mine } : { kind: 'lost', diffSec: mine - theirs }
}

export function decodeChallenge(hash: string): Challenge | null {
  const m = /^#?r(\d{1,5})((?:\.\d{1,6}){5})$/.exec(hash.trim())
  if (!m) return null
  const splits = m[2].slice(1).split('.').map(Number)
  for (let i = 1; i < splits.length; i++) if (splits[i] < splits[i - 1]) return null
  if (splits[4] <= 0) return null
  return { number: Number(m[1]), splits: splits as Challenge['splits'] }
}

/** Fraction of the route (0..1) the challenger had covered after `ms`. */
export function ghostProgress(ch: Challenge, ms: number): number {
  const t = ms / 1000
  let prevT = 0
  for (let k = 0; k < 5; k++) {
    const s = ch.splits[k]
    if (t <= s) {
      const span = s - prevT
      const within = span > 0 ? (t - prevT) / span : 1
      return (k + Math.min(1, Math.max(0, within))) / 5
    }
    prevT = s
  }
  return 1
}

/** One emoji per fifth of the route: quick, steady or slow relative to your own pace. */
export function paceEmoji(splitsMs: readonly number[]): string {
  const total = splitsMs[4]
  if (!total) return ''
  const avg = total / 5
  let out = ''
  let prev = 0
  for (const s of splitsMs) {
    const r = (s - prev) / avg
    out += r < 0.8 ? '🟩' : r <= 1.3 ? '🟨' : '🟥'
    prev = s
  }
  return out
}

export interface ShareInput {
  label: string
  ms: number
  hints: number
  backtracks: number
  splitsMs: readonly number[]
  url?: string
}

export function shareText(i: ShareInput): string {
  const hints = i.hints === 0 ? 'no hints' : plural(i.hints, 'hint')
  const lines = [
    i.label,
    `⏱ ${formatTime(i.ms)} · ${plural(i.backtracks, 'backtrack')} · ${hints}`,
    paceEmoji(i.splitsMs),
  ]
  if (i.url) lines.push(i.url)
  return lines.filter(Boolean).join('\n')
}

/** Cumulative split thresholds (route lengths) for a board with `total` squares. */
export function splitThresholds(total: number): number[] {
  return [1, 2, 3, 4, 5].map((k) => Math.ceil((total * k) / 5))
}
