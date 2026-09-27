// Puzzle generator: random board -> random full route -> add waypoints until
// the logic solver (at the tier's allowed level) proves the solution unique ->
// remove every waypoint that isn't needed -> check play quality -> grade.

import { buildGraph, colorOf, isConnected, isKnightMove } from './board'
import { findRandomRoute, solveExact } from './exact'
import { solveLogic, type Level } from './logic'
import { playMetrics, type PlayMetrics } from './path'
import type { Puzzle, Tier } from './puzzle'
import type { Rng } from './rng'

export interface TierSpec {
  tier: Tier
  rows: number
  cols: number
  /** inclusive range of blocked squares */
  holes: [number, number]
  /** hardest logic technique allowed */
  maxLevel: Level
  /** waypoints added back after pruning, placed where they remove the most guessing */
  extraWaypoints: number
  /** require at least this many lookahead steps */
  minL3?: number
  /** reject if more than this many lookahead steps */
  maxL3?: number
  /** reject if waypoints exceed this fraction of open squares */
  maxWaypointFraction?: number
  /** play difficulty window in bits of guessing (see playMetrics) */
  bits?: [number, number]
  /** max viable first moves */
  maxFirstChoices?: number
  /** max pairs of consecutive numbers one jump apart */
  maxGiveaways?: number
}

/** Picks blocked squares with 180-degree rotational symmetry. */
export function pickHoles(rows: number, cols: number, count: number, rng: Rng): number[] {
  const n = rows * cols
  const set = new Set<number>()
  let guard = 0
  while (set.size < count && guard++ < 200) {
    const cell = rng.int(n)
    const mirror = n - 1 - cell
    if (set.has(cell)) continue
    if (cell === mirror) {
      set.add(cell)
    } else if (set.size + 2 <= count) {
      set.add(cell)
      set.add(mirror)
    } else if (n % 2 === 1 && !set.has((n - 1) / 2)) {
      set.add((n - 1) / 2)
    }
  }
  return [...set].sort((a, b) => a - b)
}

/**
 * Board-level quality checks: connected, colour-balanced, no square with a
 * single jump (it would have to be the start or finish, a giveaway), and not
 * so many two-jump squares that the route is mostly forced.
 */
export function boardIsViable(rows: number, cols: number, blocked: readonly number[]): boolean {
  const graph = buildGraph(rows, cols, blocked)
  if (graph.size < 4 || !isConnected(graph)) return false
  if (graph.adj.some((a) => a.length <= 1)) return false
  const counts = [0, 0]
  for (const cell of graph.cellOf) counts[colorOf(cell, cols)]++
  if (Math.abs(counts[0] - counts[1]) > 1) return false
  if (rows * cols >= 20) {
    const twoJump = graph.adj.filter((a) => a.length === 2).length
    if (twoJump / graph.size > 0.4) return false
  }
  return true
}

/** Start and finish shouldn't touch or sit one knight jump apart. */
export function endpointsApart(cols: number, a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / cols) - Math.floor(b / cols))
  const dc = Math.abs((a % cols) - (b % cols))
  if (Math.max(dr, dc) <= 1) return false
  return !isKnightMove(cols, a, b)
}

/** On 6x6 and larger, numbers should cover at least three quadrants. */
export function spreadOk(rows: number, cols: number, waypoints: readonly number[]): boolean {
  if (rows < 6 || cols < 6) return true
  const quads = new Set(
    waypoints.map((c) => {
      const r = Math.floor(c / cols)
      const col = c % cols
      return (r < rows / 2 ? 0 : 2) + (col < cols / 2 ? 0 : 1)
    }),
  )
  return quads.size >= 3
}

function waypointsFor(route: readonly number[], idx: Iterable<number>): number[] {
  return [...idx].sort((a, b) => a - b).map((i) => route[i])
}

/**
 * Chooses a route index to turn into a waypoint so that the alternative route
 * `other` is ruled out (its visiting order relative to existing waypoints
 * differs). Prefers early positions, where wrong turns cost the most.
 */
function indexExcluding(route: number[], other: number[], idx: Set<number>, rng: Rng): number {
  const posOther = new Map(other.map((c, i) => [c, i]))
  const sortedIdx = [...idx].sort((a, b) => a - b)
  const candidates: number[] = []
  for (let i = 1; i < route.length - 1; i++) {
    if (idx.has(i)) continue
    const cell = route[i]
    const rankRoute = sortedIdx.filter((j) => j < i).length
    const po = posOther.get(cell)!
    const rankOther = sortedIdx.filter((j) => posOther.get(route[j])! < po).length
    if (rankRoute !== rankOther) candidates.push(i)
  }
  if (candidates.length) return rng.pick(candidates.slice(0, Math.ceil(candidates.length / 2)))
  let i = 0
  while (i < route.length && route[i] === other[i]) i++
  i = Math.min(Math.max(i, 1), route.length - 2)
  while (idx.has(i) && i < route.length - 2) i++
  return i
}

/** Waypoint indices that sit right after another waypoint on the route. */
function isGiveaway(i: number, idx: Set<number>): boolean {
  return idx.has(i - 1) || idx.has(i + 1)
}

export interface GenerateResult {
  puzzle: Puzzle | null
  attempts: number
  metrics?: PlayMetrics
}

export function generatePuzzle(
  spec: TierSpec,
  rng: Rng,
  id: string,
  maxAttempts = 80,
  /** optional tally of why candidates were rejected (for tuning) */
  rejects?: Record<string, number>,
): GenerateResult {
  const { rows, cols } = spec
  const reject = (why: string) => {
    if (rejects) rejects[why] = (rejects[why] ?? 0) + 1
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const holeCount = spec.holes[0] + rng.int(spec.holes[1] - spec.holes[0] + 1)
    const blocked = pickHoles(rows, cols, holeCount, rng)
    if (!boardIsViable(rows, cols, blocked)) {
      reject('board')
      continue
    }
    const route = findRandomRoute(rows, cols, blocked, rng, 20_000, 12, 0.7)
    if (!route) {
      reject('route')
      continue
    }
    const M = route.length
    if (!endpointsApart(cols, route[0], route[M - 1])) {
      reject('endpoints')
      continue
    }
    const idx = new Set<number>([0, M - 1])
    const base = { rows, cols, blocked }
    const solves = (set: Set<number>) =>
      solveLogic({ ...base, waypoints: waypointsFor(route, set) }, spec.maxLevel)

    // Add waypoints until the logic solver can finish.
    let solved = false
    for (let guard = 0; guard < M; guard++) {
      const res = solves(idx)
      if (res.contradiction) throw new Error('generator produced a contradiction on a known solution')
      if (res.solved) {
        solved = true
        break
      }
      const alt = solveExact({ ...base, waypoints: waypointsFor(route, idx) }, { limit: 2, maxNodes: 150_000 })
      const other = alt.solutions.find((s) => s.some((c, i) => c !== route[i]))
      let pickIdx: number
      if (other) {
        pickIdx = indexExcluding(route, other, idx, rng)
      } else {
        // Unique (or search budget hit) but too hard for this tier: add a
        // waypoint where the solver is least certain, leaning early.
        const posRoute = new Map(route.map((c, i) => [c, i]))
        let best = -1
        let bestScore = -1
        res.graph.cellOf.forEach((cell, node) => {
          const i = posRoute.get(cell)!
          if (idx.has(i)) return
          const score = res.undecided[node] + (1 - i / M) + rng.next() * 0.5
          if (score > bestScore) {
            bestScore = score
            best = i
          }
        })
        if (best < 0) break
        pickIdx = best
      }
      idx.add(pickIdx)
    }
    if (!solved) {
      reject('unsolved')
      continue
    }

    // Prune: give-away numbers first, then latest first (early numbers help most).
    const removable = [...idx]
      .filter((i) => i !== 0 && i !== M - 1)
      .sort((a, b) => Number(isGiveaway(b, idx)) - Number(isGiveaway(a, idx)) || b - a)
    for (const i of removable) {
      idx.delete(i)
      if (!solves(idx).solved) idx.add(i)
    }

    // Bonus numbers where they remove the most guessing.
    for (let k = 0; k < spec.extraWaypoints; k++) {
      let best = -1
      let bestBits = Infinity
      for (let i = 1; i < M - 1; i++) {
        if (idx.has(i) || isGiveaway(i, idx)) continue
        const trial = new Set(idx)
        trial.add(i)
        const bits = playMetrics({ id, rows, cols, blocked, waypoints: waypointsFor(route, trial), solution: route }).bits
        if (bits < bestBits - 1e-9) {
          bestBits = bits
          best = i
        }
      }
      if (best < 0) break
      idx.add(best)
    }

    const waypoints = waypointsFor(route, idx)
    const final = solveLogic({ ...base, waypoints }, spec.maxLevel)
    if (!final.solved) {
      reject('final')
      continue
    }
    if (final.route!.some((c, i) => c !== route[i])) throw new Error('logic solver found a different route')
    if (spec.minL3 !== undefined && final.grade.l3 < spec.minL3) {
      reject('minL3')
      continue
    }
    if (spec.maxL3 !== undefined && final.grade.l3 > spec.maxL3) {
      reject('maxL3')
      continue
    }
    if (spec.maxWaypointFraction !== undefined && waypoints.length > spec.maxWaypointFraction * M) {
      reject('density')
      continue
    }
    if (!spreadOk(rows, cols, waypoints)) {
      reject('spread')
      continue
    }

    const puzzle: Puzzle = { id, rows, cols, blocked, waypoints, solution: route, tier: spec.tier }
    const m = playMetrics(puzzle)
    if (spec.bits && m.bits < spec.bits[0]) {
      reject('bits-low')
      continue
    }
    if (spec.bits && m.bits > spec.bits[1]) {
      reject('bits-high')
      continue
    }
    if (spec.maxFirstChoices !== undefined && m.firstChoices > spec.maxFirstChoices) {
      reject('first')
      continue
    }
    if (spec.maxGiveaways !== undefined && m.giveawayPairs > spec.maxGiveaways) {
      reject('giveaway')
      continue
    }
    if (m.longestForcedRun > 0.4 * M) {
      reject('forced-run')
      continue
    }

    puzzle.grade = { ...final.grade, score: Math.round(m.bits * 10) / 10 }
    return { puzzle, attempts: attempt, metrics: m }
  }
  return { puzzle: null, attempts: maxAttempts }
}
