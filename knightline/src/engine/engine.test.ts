import { describe, expect, it } from 'vitest'
import {
  buildGraph,
  checkMove,
  checkRoute,
  decodeCells,
  deduceEdges,
  divergenceIndex,
  encodeCells,
  findRandomRoute,
  generatePuzzle,
  isConnected,
  isKnightMove,
  isSolved,
  knightTargets,
  legalTargets,
  makeGame,
  makeRng,
  nextWaypoint,
  puzzleFromJSON,
  puzzleToJSON,
  solveExact,
  solveLogic,
  strandedCells,
  type Puzzle,
  type TierSpec,
} from './index'

// ---------------------------------------------------------------------------
// Brute force reference: every full route satisfying the puzzle, no pruning.
function bruteForce(p: Pick<Puzzle, 'rows' | 'cols' | 'blocked' | 'waypoints'>): number[][] {
  const g = buildGraph(p.rows, p.cols, p.blocked)
  const out: number[][] = []
  const start = p.waypoints[0]
  const wpIndex = new Map(p.waypoints.map((c, i) => [c, i]))
  const route = [start]
  const seen = new Set([start])
  const rec = () => {
    const head = route[route.length - 1]
    if (route.length === g.size) {
      if (checkRoute(p, route) === null) out.push([...route])
      return
    }
    for (const n of g.adj[g.nodeOf[head]]) {
      const cell = g.cellOf[n]
      if (seen.has(cell)) continue
      seen.add(cell)
      route.push(cell)
      rec()
      route.pop()
      seen.delete(cell)
    }
  }
  if (wpIndex.get(start) === 0) rec()
  return out
}

/** Random small puzzle built on a random full route, with random waypoints. */
function randomSmallPuzzle(seed: string): Puzzle | null {
  const rng = makeRng(seed)
  const shapes: Array<[number, number]> = [[3, 4], [4, 4], [3, 5], [4, 5], [3, 6]]
  const [rows, cols] = rng.pick(shapes)
  const holes = rng.int(rows * cols > 16 ? 4 : 2)
  const blocked = [...new Set(Array.from({ length: holes }, () => rng.int(rows * cols)))].sort((a, b) => a - b)
  const graph = buildGraph(rows, cols, blocked)
  if (graph.size < 6 || !isConnected(graph)) return null
  const route = findRandomRoute(rows, cols, blocked, rng, 50_000, 30)
  if (!route) return null
  const M = route.length
  const idx = new Set([0, M - 1])
  const extra = rng.int(Math.max(1, Math.floor(M / 4)))
  for (let i = 0; i < extra; i++) idx.add(1 + rng.int(M - 2))
  const waypoints = [...idx].sort((a, b) => a - b).map((i) => route[i])
  return { id: seed, rows, cols, blocked, waypoints, solution: route }
}

function edgeKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

function routeEdges(route: number[]): Set<string> {
  const s = new Set<string>()
  for (let i = 1; i < route.length; i++) s.add(edgeKey(route[i - 1], route[i]))
  return s
}

const SMALL_SEEDS = Array.from({ length: 400 }, (_, i) => `small-${i}`)
const smallPuzzles = SMALL_SEEDS.map(randomSmallPuzzle).filter((p): p is Puzzle => p !== null)

// ---------------------------------------------------------------------------
describe('board', () => {
  it('computes knight moves', () => {
    expect(knightTargets(5, 5, 0).sort((a, b) => a - b)).toEqual([7, 11])
    expect(knightTargets(5, 5, 12)).toHaveLength(8)
    expect(isKnightMove(5, 0, 7)).toBe(true)
    expect(isKnightMove(5, 7, 0)).toBe(true)
    expect(isKnightMove(5, 0, 6)).toBe(false)
    // wrapping across rows must not count
    expect(isKnightMove(5, 4, 6)).toBe(false)
  })

  it('builds the graph over open squares only', () => {
    const g = buildGraph(5, 5, [7])
    expect(g.size).toBe(24)
    expect(g.nodeOf[7]).toBe(-1)
    expect(g.adj[g.nodeOf[0]].map((n) => g.cellOf[n])).toEqual([11])
  })
})

describe('encoding', () => {
  it('round-trips cells and puzzles', () => {
    const cells = [0, 5, 48, 63, 12]
    expect(decodeCells(encodeCells(cells))).toEqual(cells)
    const p: Puzzle = {
      id: 't', rows: 7, cols: 7, blocked: [3, 45], waypoints: [0, 48], solution: [0, 48],
      tier: 'hard', grade: { maxLevel: 3, l1: 1, l2: 2, l3: 3, score: 40 },
    }
    expect(puzzleFromJSON(puzzleToJSON(p))).toEqual(p)
  })
})

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = makeRng('seed')
    const b = makeRng('seed')
    const xs = Array.from({ length: 5 }, () => a.next())
    expect(Array.from({ length: 5 }, () => b.next())).toEqual(xs)
    expect(makeRng('other').next()).not.toBe(xs[0])
  })
})

describe('checkRoute', () => {
  const p = smallPuzzles[0]
  it('accepts the known solution', () => {
    expect(checkRoute(p, p.solution)).toBeNull()
  })
  it('rejects broken routes', () => {
    expect(checkRoute(p, p.solution.slice(0, -1))).not.toBeNull()
    expect(checkRoute(p, [...p.solution].reverse())).not.toBeNull()
    const swapped = [...p.solution]
    ;[swapped[1], swapped[2]] = [swapped[2], swapped[1]]
    expect(checkRoute(p, swapped)).not.toBeNull()
  })
})

describe('exact solver vs brute force', () => {
  it('has enough small puzzles to test', () => {
    expect(smallPuzzles.length).toBeGreaterThan(60)
  })

  it('finds exactly the same number of solutions', () => {
    let multi = 0
    for (const p of smallPuzzles) {
      const truth = bruteForce(p)
      expect(truth.length).toBeGreaterThan(0)
      const res = solveExact(p, { limit: 100_000, maxNodes: 5_000_000 })
      expect(res.complete).toBe(true)
      expect(res.solutions.length).toBe(truth.length)
      const truthSet = new Set(truth.map((r) => r.join(',')))
      for (const s of res.solutions) expect(truthSet.has(s.join(','))).toBe(true)
      if (truth.length > 1) multi++
    }
    // make sure the test covers ambiguous puzzles too
    expect(multi).toBeGreaterThan(10)
  })
})

describe('logic solver', () => {
  it('never rules out a real solution (soundness), at every level', () => {
    for (const p of smallPuzzles) {
      const truth = bruteForce(p)
      for (const level of [1, 2, 3] as const) {
        const d = deduceEdges(p, level)
        expect(d.contradiction).toBe(false)
        for (const sol of truth) {
          const edges = routeEdges(sol)
          for (const [a, b] of d.on) expect(edges.has(edgeKey(a, b))).toBe(true)
          for (const [a, b] of d.off) expect(edges.has(edgeKey(a, b))).toBe(false)
        }
      }
    }
  })

  it('only claims "solved" when the solution is unique, and finds it', () => {
    let solvedCount = 0
    for (const p of smallPuzzles) {
      const truth = bruteForce(p)
      const res = solveLogic(p, 3)
      if (res.solved) {
        solvedCount++
        expect(truth.length).toBe(1)
        expect(res.route).toEqual(truth[0])
      }
    }
    expect(solvedCount).toBeGreaterThan(10)
  })

  it('grades by the hardest technique used', () => {
    for (const p of smallPuzzles.slice(0, 40)) {
      const r2 = solveLogic(p, 2)
      if (r2.solved) expect(r2.grade.l3).toBe(0)
      const r1 = solveLogic(p, 1)
      if (r1.solved) {
        expect(r1.grade.l2).toBe(0)
        expect(r1.grade.maxLevel).toBe(1)
      }
    }
  })
})

describe('generator', () => {
  const specs: TierSpec[] = [
    { tier: 'easy', rows: 5, cols: 5, holes: [0, 3], maxLevel: 2, extraWaypoints: 1 },
    { tier: 'medium', rows: 6, cols: 6, holes: [2, 5], maxLevel: 2, extraWaypoints: 0 },
    { tier: 'hard', rows: 6, cols: 6, holes: [2, 5], maxLevel: 3, extraWaypoints: 0, minL3: 1 },
    { tier: 'hard', rows: 7, cols: 7, holes: [3, 7], maxLevel: 3, extraWaypoints: 0, minL3: 1, maxL3: 15 },
  ]

  for (const spec of specs) {
    it(`produces valid, unique ${spec.rows}x${spec.cols} L${spec.maxLevel} puzzles`, () => {
      const rng = makeRng(`gen-test-${spec.rows}-${spec.maxLevel}`)
      for (let i = 0; i < 5; i++) {
        const { puzzle } = generatePuzzle(spec, rng, `g${i}`)
        expect(puzzle).not.toBeNull()
        const p = puzzle!
        expect(checkRoute(p, p.solution)).toBeNull()
        const exact = solveExact(p, { limit: 2, maxNodes: 5_000_000 })
        expect(exact.complete).toBe(true)
        expect(exact.solutions).toHaveLength(1)
        const logic = solveLogic(p, spec.maxLevel)
        expect(logic.solved).toBe(true)
        expect(logic.route).toEqual(p.solution)
        if (spec.minL3) expect(p.grade!.l3).toBeGreaterThanOrEqual(spec.minL3)
        if (spec.maxL3) expect(p.grade!.l3).toBeLessThanOrEqual(spec.maxL3)
        // symmetric holes
        const n = p.rows * p.cols
        for (const b of p.blocked) expect(p.blocked).toContain(n - 1 - b)
      }
    })
  }

  it('is deterministic for a seed', () => {
    const spec = specs[1]
    const a = generatePuzzle(spec, makeRng('same'), 'a').puzzle
    const b = generatePuzzle(spec, makeRng('same'), 'a').puzzle
    expect(a).toEqual(b)
  })
})

describe('player rules', () => {
  const p = smallPuzzles.find((q) => q.waypoints.length >= 3 && q.solution.length >= 8)!
  const game = makeGame(p)

  it('starts at 1 and only allows legal jumps', () => {
    const route = [p.solution[0]]
    const legal = legalTargets(game, route)
    expect(legal).toContain(p.solution[1])
    for (const t of legal) expect(isKnightMove(p.cols, route[0], t)).toBe(true)
    expect(checkMove(game, route, route[0])).toBe('visited')
    for (const b of p.blocked) expect(checkMove(game, route, b)).toBe('blocked')
  })

  it('enforces waypoint order and finishing last', () => {
    const finish = p.waypoints[p.waypoints.length - 1]
    // Find a route prefix whose head can jump to a later waypoint or the finish early.
    const route = [p.solution[0]]
    for (let i = 1; i < p.solution.length - 1; i++) {
      const head = route[route.length - 1]
      for (const n of game.neighbors.get(head)!) {
        if (route.includes(n)) continue
        const w = game.waypointIndex.get(n)
        if (w !== undefined && w > nextWaypoint(game, route) && n !== finish) {
          expect(checkMove(game, route, n)).toBe('order')
        }
        if (n === finish && route.length + 1 < game.total) {
          expect(['finish-last', 'order']).toContain(checkMove(game, route, n))
        }
      }
      route.push(p.solution[i])
    }
  })

  it('recognises a finished route and divergence', () => {
    expect(isSolved(game, p.solution)).toBe(true)
    expect(isSolved(game, p.solution.slice(0, -1))).toBe(false)
    expect(divergenceIndex(game, p.solution.slice(0, 5))).toBe(-1)
  })

  it('flags stranded squares', () => {
    // Walk the solution; a correct prefix never strands anything.
    for (let i = 1; i <= p.solution.length; i++) {
      expect(strandedCells(game, p.solution.slice(0, i))).toEqual([])
    }
  })
})
