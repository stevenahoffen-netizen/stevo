// Player-facing rules: which jumps are legal from the current route, which
// squares are stranded, and whether the route is complete.

import { buildGraph, type Graph } from './board'
import type { Puzzle } from './puzzle'

export type MoveError = 'blocked' | 'visited' | 'not-knight' | 'order' | 'finish-last'

export interface Game {
  readonly puzzle: Puzzle
  readonly graph: Graph
  /** cell -> waypoint index (0-based) */
  readonly waypointIndex: ReadonlyMap<number, number>
  readonly finish: number
  readonly total: number
  /** cell -> set of knight-adjacent open cells */
  readonly neighbors: ReadonlyMap<number, readonly number[]>
}

export function makeGame(puzzle: Puzzle): Game {
  const graph = buildGraph(puzzle.rows, puzzle.cols, puzzle.blocked)
  const neighbors = new Map<number, number[]>()
  graph.cellOf.forEach((cell, node) => {
    neighbors.set(cell, graph.adj[node].map((n) => graph.cellOf[n]))
  })
  return {
    puzzle,
    graph,
    waypointIndex: new Map(puzzle.waypoints.map((c, i) => [c, i])),
    finish: puzzle.waypoints[puzzle.waypoints.length - 1],
    total: graph.size,
    neighbors,
  }
}

/** Index (0-based) of the next waypoint the route must reach. */
export function nextWaypoint(game: Game, route: readonly number[]): number {
  let next = 0
  for (const cell of route) {
    if (game.waypointIndex.get(cell) === next) next++
  }
  return next
}

export function isOpen(game: Game, cell: number): boolean {
  return cell >= 0 && cell < game.puzzle.rows * game.puzzle.cols && game.graph.nodeOf[cell] >= 0
}

/** Why a jump from the end of `route` to `target` is not allowed, or null if it is. */
export function checkMove(game: Game, route: readonly number[], target: number): MoveError | null {
  if (!isOpen(game, target)) return 'blocked'
  if (route.includes(target)) return 'visited'
  const head = route[route.length - 1]
  if (!game.neighbors.get(head)!.includes(target)) return 'not-knight'
  const w = game.waypointIndex.get(target)
  if (w !== undefined) {
    if (w !== nextWaypoint(game, route)) return 'order'
  }
  if (target === game.finish && route.length + 1 !== game.total) return 'finish-last'
  return null
}

export function legalTargets(game: Game, route: readonly number[]): number[] {
  const head = route[route.length - 1]
  return game.neighbors.get(head)!.filter((t) => checkMove(game, route, t) === null)
}

/**
 * For each unvisited square, how many ways in/out it still has: unvisited
 * knight-neighbours, plus one if it can be reached from the current square.
 */
export function exitCounts(game: Game, route: readonly number[]): Map<number, number> {
  const visited = new Set(route)
  const head = route[route.length - 1]
  const out = new Map<number, number>()
  for (const cell of game.graph.cellOf) {
    if (visited.has(cell)) continue
    let n = 0
    for (const nb of game.neighbors.get(cell)!) {
      if (!visited.has(nb) || nb === head) n++
    }
    out.set(cell, n)
  }
  return out
}

/** Unvisited squares that can no longer be reached at all. */
export function strandedCells(game: Game, route: readonly number[]): number[] {
  if (route.length >= game.total) return []
  const out: number[] = []
  for (const [cell, n] of exitCounts(game, route)) {
    if (n === 0) out.push(cell)
  }
  return out
}

/**
 * Squares the current route has already doomed: a square with no way in, or
 * any square other than the finish that has only one way left (it could be
 * entered but never left). This is the corner rule applied as instant
 * feedback, so wrong turns show up the moment they happen.
 */
export function doomedCells(game: Game, route: readonly number[]): number[] {
  if (route.length >= game.total) return []
  const out: number[] = []
  for (const [cell, n] of exitCounts(game, route)) {
    if (n === 0 || (n === 1 && cell !== game.finish)) out.push(cell)
  }
  return out
}

/** True if the route can no longer lead to a solution by the doomed-square rule or has no moves. */
export function isDoomed(game: Game, route: readonly number[]): boolean {
  if (isSolved(game, route)) return false
  return doomedCells(game, route).length > 0 || legalTargets(game, route).length === 0
}

export function isSolved(game: Game, route: readonly number[]): boolean {
  if (route.length !== game.total) return false
  if (route[route.length - 1] !== game.finish) return false
  return nextWaypoint(game, route) === game.puzzle.waypoints.length
}

/**
 * -1 if `route` is a prefix of the solution, otherwise the first index where
 * it differs (the route is correct up to index-1).
 */
export function divergenceIndex(game: Game, route: readonly number[]): number {
  const sol = game.puzzle.solution
  for (let i = 0; i < route.length; i++) {
    if (route[i] !== sol[i]) return i
  }
  return -1
}

export interface PlayMetrics {
  /** sum of log2(viable choices) along the solution: the guessing a careful player faces */
  bits: number
  /** number of steps with 2+ viable choices */
  decisions: number
  /** viable choices on the first move */
  firstChoices: number
  /** share of steps where exactly one square glows */
  oneGlowShare: number
  /** longest run of consecutive steps with exactly one glowing square */
  longestForcedRun: number
  /** consecutive numbers k, k+1 placed one jump apart on the route */
  giveawayPairs: number
}

/**
 * Walks the solution and measures what a careful player faces at each step,
 * counting only choices that aren't immediately doomed.
 */
export function playMetrics(puzzle: Puzzle): PlayMetrics {
  const game = makeGame(puzzle)
  const sol = puzzle.solution
  let bits = 0
  let decisions = 0
  let firstChoices = 0
  let oneGlow = 0
  let run = 0
  let longest = 0
  for (let i = 0; i < sol.length - 1; i++) {
    const route = sol.slice(0, i + 1)
    const legal = legalTargets(game, route)
    let viable = 0
    for (const t of legal) {
      if (t === sol[i + 1] || !isDoomed(game, [...route, t])) viable++
    }
    if (i === 0) firstChoices = viable
    if (viable > 1) {
      decisions++
      bits += Math.log2(viable)
    }
    if (legal.length === 1) {
      oneGlow++
      run++
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }
  const pos = new Map(sol.map((c, i) => [c, i]))
  let giveawayPairs = 0
  for (let k = 1; k < puzzle.waypoints.length; k++) {
    if (pos.get(puzzle.waypoints[k])! - pos.get(puzzle.waypoints[k - 1])! === 1) giveawayPairs++
  }
  return {
    bits,
    decisions,
    firstChoices,
    oneGlowShare: oneGlow / Math.max(1, sol.length - 1),
    longestForcedRun: longest,
    giveawayPairs,
  }
}
