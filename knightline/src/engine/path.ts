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
