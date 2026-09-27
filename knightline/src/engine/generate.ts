// Puzzle generator: random board -> random full route -> add waypoints until
// the logic solver (at the tier's allowed level) proves the solution unique ->
// remove every waypoint that isn't needed -> grade.

import { buildGraph, colorOf, isConnected } from './board'
import { findRandomRoute, solveExact } from './exact'
import { solveLogic, type Level } from './logic'
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
  /** waypoints to add back after pruning (makes easy tiers gentler) */
  extraWaypoints: number
  /** require at least this many lookahead steps (hard tiers) */
  minL3?: number
  /** reject if more than this many lookahead steps */
  maxL3?: number
  /** reject if waypoints exceed this fraction of open squares */
  maxWaypointFraction?: number
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

function boardIsViable(rows: number, cols: number, blocked: number[]): boolean {
  const graph = buildGraph(rows, cols, blocked)
  if (graph.size < 4 || !isConnected(graph)) return false
  if (graph.adj.some((a) => a.length === 0)) return false
  const counts = [0, 0]
  for (const cell of graph.cellOf) counts[colorOf(cell, cols)]++
  return Math.abs(counts[0] - counts[1]) <= 1
}

function waypointsFor(route: number[], idx: number[]): number[] {
  return [...idx].sort((a, b) => a - b).map((i) => route[i])
}

/**
 * Chooses a route index to turn into a waypoint so that the alternative route
 * `other` is ruled out (its visiting order relative to existing waypoints differs).
 */
function indexExcluding(route: number[], other: number[], idx: Set<number>, rng: Rng): number {
  const posOther = new Map(other.map((c, i) => [c, i]))
  const wpCells = [...idx].map((i) => route[i])
  const candidates: number[] = []
  for (let i = 1; i < route.length - 1; i++) {
    if (idx.has(i)) continue
    const cell = route[i]
    const rankRoute = [...idx].filter((j) => j < i).length
    const po = posOther.get(cell)!
    const rankOther = wpCells.filter((c) => posOther.get(c)! < po).length
    if (rankRoute !== rankOther) candidates.push(i)
  }
  if (candidates.length) return rng.pick(candidates)
  let i = 0
  while (i < route.length && route[i] === other[i]) i++
  i = Math.min(Math.max(i, 1), route.length - 2)
  while (idx.has(i) && i < route.length - 2) i++
  return i
}

export interface GenerateResult {
  puzzle: Puzzle | null
  attempts: number
}

export function generatePuzzle(spec: TierSpec, rng: Rng, id: string, maxAttempts = 60): GenerateResult {
  const { rows, cols } = spec
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const holeCount = spec.holes[0] + rng.int(spec.holes[1] - spec.holes[0] + 1)
    const blocked = pickHoles(rows, cols, holeCount, rng)
    if (!boardIsViable(rows, cols, blocked)) continue
    const route = findRandomRoute(rows, cols, blocked, rng)
    if (!route) continue
    const M = route.length
    const idx = new Set<number>([0, M - 1])
    const base = { rows, cols, blocked }

    // Add waypoints until the logic solver can finish.
    let solved = false
    for (let guard = 0; guard < M; guard++) {
      const res = solveLogic({ ...base, waypoints: waypointsFor(route, [...idx]) }, spec.maxLevel)
      if (res.contradiction) throw new Error('generator produced a contradiction on a known solution')
      if (res.solved) {
        solved = true
        break
      }
      const alt = solveExact({ ...base, waypoints: waypointsFor(route, [...idx]) }, { limit: 2, maxNodes: 150_000 })
      const other = alt.solutions.find((s) => s.some((c, i) => c !== route[i]))
      let pickIdx: number
      if (other) {
        pickIdx = indexExcluding(route, other, idx, rng)
      } else {
        // Unique (or search budget hit) but too hard for this tier: add a
        // waypoint where the solver is least certain.
        const posRoute = new Map(route.map((c, i) => [c, i]))
        let best = -1
        let bestScore = -1
        res.graph.cellOf.forEach((cell, node) => {
          const i = posRoute.get(cell)!
          if (idx.has(i)) return
          const score = res.undecided[node] + rng.next() * 0.5
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
    if (!solved) continue

    // Prune waypoints that aren't needed.
    const removable = rng.shuffle([...idx].filter((i) => i !== 0 && i !== M - 1))
    for (const i of removable) {
      idx.delete(i)
      const res = solveLogic({ ...base, waypoints: waypointsFor(route, [...idx]) }, spec.maxLevel)
      if (!res.solved) idx.add(i)
    }

    // Gentler tiers: add back evenly spaced waypoints.
    for (let k = 1; k <= spec.extraWaypoints; k++) {
      let target = Math.round((k * (M - 1)) / (spec.extraWaypoints + 1))
      let step = 0
      while (idx.has(target) && step < M) {
        step++
        target = Math.round((k * (M - 1)) / (spec.extraWaypoints + 1)) + (step % 2 ? step : -step) / 2
        target = Math.min(Math.max(target, 1), M - 2)
      }
      idx.add(target)
    }

    const waypoints = waypointsFor(route, [...idx])
    const final = solveLogic({ ...base, waypoints }, spec.maxLevel)
    if (!final.solved) continue
    if (final.route!.some((c, i) => c !== route[i])) throw new Error('logic solver found a different route')
    if (spec.minL3 !== undefined && final.grade.l3 < spec.minL3) continue
    if (spec.maxL3 !== undefined && final.grade.l3 > spec.maxL3) continue
    if (spec.maxWaypointFraction !== undefined && waypoints.length > spec.maxWaypointFraction * M) continue

    return {
      puzzle: { id, rows, cols, blocked, waypoints, solution: route, tier: spec.tier, grade: final.grade },
      attempts: attempt,
    }
  }
  return { puzzle: null, attempts: maxAttempts }
}
