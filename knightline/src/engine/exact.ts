// Exact search over routes. Used to prove uniqueness, to find alternative
// routes while generating, and to find random full routes.

import { buildGraph, colorOf, type Graph } from './board'
import type { Rng } from './rng'

export interface ExactOptions {
  /** stop after this many solutions (default 2) */
  limit?: number
  /** search budget in visited states (default 2,000,000) */
  maxNodes?: number
  /** randomise move order among equally good candidates */
  rng?: Rng
}

export interface ExactResult {
  /** solutions found, as cells */
  solutions: number[][]
  /** true if the search space was fully explored (or the limit was reached) */
  complete: boolean
  nodes: number
}

interface SearchSpec {
  graph: Graph
  start: number
  /** fixed end node, or -1 for "any" */
  end: number
  /** node -> waypoint index, or -1 */
  wp: Int16Array
  wpCount: number
}

class Search {
  readonly M: number
  readonly visited: Uint8Array
  readonly deg: Uint8Array
  readonly adjMat: Uint8Array
  readonly path: Int16Array
  readonly solutions: number[][] = []
  nodes = 0
  aborted = false

  constructor(
    readonly spec: SearchSpec,
    readonly limit: number,
    readonly maxNodes: number,
    readonly rng?: Rng,
  ) {
    const { graph } = spec
    this.M = graph.size
    this.visited = new Uint8Array(this.M)
    this.deg = new Uint8Array(this.M)
    this.adjMat = new Uint8Array(this.M * this.M)
    this.path = new Int16Array(this.M)
    for (let v = 0; v < this.M; v++) {
      this.deg[v] = graph.adj[v].length
      for (const u of graph.adj[v]) this.adjMat[v * this.M + u] = 1
    }
  }

  private visit(v: number) {
    this.visited[v] = 1
    for (const u of this.spec.graph.adj[v]) this.deg[u]--
  }

  private unvisit(v: number) {
    this.visited[v] = 0
    for (const u of this.spec.graph.adj[v]) this.deg[u]++
  }

  run() {
    const { start, wp } = this.spec
    this.visit(start)
    this.path[0] = start
    this.dfs(start, 0, wp[start] === 0 ? 1 : 0)
    this.unvisit(start)
  }

  /**
   * Returns -2 if the position is dead, -1 if no move is forced, otherwise the
   * node that must be entered next.
   */
  private analyse(head: number, remaining: number): number {
    const { M, visited, deg, adjMat } = this
    const { end } = this.spec
    const fixedEnd = end >= 0
    let forced = -1
    let freeEndCandidates = 0
    let firstUnvisited = -1
    for (let v = 0; v < M; v++) {
      if (visited[v]) continue
      if (firstUnvisited < 0) firstUnvisited = v
      const nearHead = adjMat[head * M + v]
      const avail = deg[v] + nearHead
      if (avail === 0) return -2
      if (fixedEnd) {
        if (v === end) {
          // The finish must be entered last, from an unvisited neighbour.
          if (deg[v] === 0 && remaining > 1) return -2
          continue
        }
        if (avail < 2) return -2
        if (nearHead && avail === 2) {
          if (forced >= 0 && forced !== v) return -2
          forced = v
        }
      } else if (avail < 2) {
        // With a free finish, at most one square may be a dead end (the finish).
        if (++freeEndCandidates > 1) return -2
      }
    }
    // Connectivity: the unvisited squares must form one region the head touches.
    if (firstUnvisited < 0) return -1
    const seen = new Uint8Array(M)
    const stack = [firstUnvisited]
    seen[firstUnvisited] = 1
    let count = 1
    const adj = this.spec.graph.adj
    while (stack.length) {
      const v = stack.pop()!
      for (const u of adj[v]) {
        if (!visited[u] && !seen[u]) {
          seen[u] = 1
          count++
          stack.push(u)
        }
      }
    }
    if (count !== remaining) return -2
    let touches = false
    for (const u of adj[head]) {
      if (!visited[u]) {
        touches = true
        break
      }
    }
    if (!touches) return -2
    return forced
  }

  private dfs(head: number, depth: number, nextWp: number) {
    if (this.aborted || this.solutions.length >= this.limit) return
    if (++this.nodes > this.maxNodes) {
      this.aborted = true
      return
    }
    const { M } = this
    const { end, wp, wpCount } = this.spec
    const remaining = M - (depth + 1)
    if (remaining === 0) {
      if ((end < 0 || head === end) && nextWp === wpCount) {
        this.solutions.push(Array.from(this.path.subarray(0, M)))
      }
      return
    }
    const forced = this.analyse(head, remaining)
    if (forced === -2) return

    const candidates: number[] = []
    for (const u of this.spec.graph.adj[head]) {
      if (this.visited[u]) continue
      if (wp[u] >= 0 && wp[u] !== nextWp) continue
      if (u === end && remaining > 1) continue
      if (forced >= 0 && u !== forced) continue
      candidates.push(u)
    }
    if (forced >= 0 && candidates.length === 0) return
    if (this.rng) this.rng.shuffle(candidates)
    // Warnsdorff: try the most constrained square first.
    candidates.sort((a, b) => this.deg[a] - this.deg[b])

    for (const u of candidates) {
      this.visit(u)
      this.path[depth + 1] = u
      this.dfs(u, depth + 1, nextWp + (wp[u] >= 0 ? 1 : 0))
      this.unvisit(u)
      if (this.aborted || this.solutions.length >= this.limit) return
    }
  }
}

/** Counts (up to `limit`) routes that solve the puzzle. */
export function solveExact(
  p: { rows: number; cols: number; blocked: readonly number[]; waypoints: readonly number[] },
  opts: ExactOptions = {},
): ExactResult {
  const graph = buildGraph(p.rows, p.cols, p.blocked)
  const wp = new Int16Array(graph.size).fill(-1)
  p.waypoints.forEach((cell, i) => {
    const n = graph.nodeOf[cell]
    if (n < 0) throw new Error(`waypoint ${cell} is blocked`)
    wp[n] = i
  })
  const start = graph.nodeOf[p.waypoints[0]]
  const end = graph.nodeOf[p.waypoints[p.waypoints.length - 1]]
  const search = new Search(
    { graph, start, end, wp, wpCount: p.waypoints.length },
    opts.limit ?? 2,
    opts.maxNodes ?? 2_000_000,
    opts.rng,
  )
  search.run()
  return {
    solutions: search.solutions.map((route) => route.map((n) => graph.cellOf[n])),
    complete: !search.aborted,
    nodes: search.nodes,
  }
}

/**
 * Finds a random full route (no waypoints) over the open squares, or null.
 * Tries several random starting squares of the right colour.
 */
export function findRandomRoute(
  rows: number,
  cols: number,
  blocked: readonly number[],
  rng: Rng,
  maxNodesPerStart = 20_000,
  starts = 12,
): number[] | null {
  const graph = buildGraph(rows, cols, blocked)
  const counts = [0, 0]
  for (const cell of graph.cellOf) counts[colorOf(cell, cols)]++
  const diff = counts[0] - counts[1]
  if (Math.abs(diff) > 1) return null
  const wantColor = diff === 0 ? -1 : diff > 0 ? 0 : 1
  const candidates = graph.cellOf
    .map((cell, node) => ({ cell, node }))
    .filter(({ cell }) => wantColor < 0 || colorOf(cell, cols) === wantColor)
  rng.shuffle(candidates)
  const wp = new Int16Array(graph.size).fill(-1)
  for (const { node } of candidates.slice(0, starts)) {
    const search = new Search({ graph, start: node, end: -1, wp, wpCount: 0 }, 1, maxNodesPerStart, rng)
    search.run()
    if (search.solutions.length) return search.solutions[0].map((n) => graph.cellOf[n])
  }
  return null
}
