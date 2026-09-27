import { buildGraph, isKnightMove } from './board'

export type Tier = 'easy' | 'medium' | 'hard'

export interface Grade {
  /** hardest technique needed: 1 forced, 2 structure, 3 lookahead */
  maxLevel: 1 | 2 | 3
  l1: number
  l2: number
  l3: number
  /** rough difficulty score, higher is harder */
  score: number
}

export interface Puzzle {
  id: string
  rows: number
  cols: number
  /** blocked cells */
  blocked: number[]
  /** waypoint cells in order; waypoints[0] is "1" (start), the last is the finish */
  waypoints: number[]
  /** the unique full route, as cells */
  solution: number[]
  tier?: Tier
  grade?: Grade
}

/** Compact JSON form used for bundled content. */
export interface PuzzleJSON {
  id: string
  r: number
  c: number
  b: string
  w: string
  s: string
  t?: Tier
  g?: [number, number, number, number, number]
}

// 64-symbol alphabet: one character per cell index (boards up to 64 cells).
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'

export function encodeCells(cells: readonly number[]): string {
  return cells
    .map((c) => {
      if (c < 0 || c >= ALPHABET.length) throw new Error(`cell ${c} out of range`)
      return ALPHABET[c]
    })
    .join('')
}

export function decodeCells(text: string): number[] {
  return [...text].map((ch) => {
    const i = ALPHABET.indexOf(ch)
    if (i < 0) throw new Error(`bad cell char ${ch}`)
    return i
  })
}

export function puzzleToJSON(p: Puzzle): PuzzleJSON {
  const out: PuzzleJSON = {
    id: p.id,
    r: p.rows,
    c: p.cols,
    b: encodeCells(p.blocked),
    w: encodeCells(p.waypoints),
    s: encodeCells(p.solution),
  }
  if (p.tier) out.t = p.tier
  if (p.grade) out.g = [p.grade.maxLevel, p.grade.l1, p.grade.l2, p.grade.l3, p.grade.score]
  return out
}

export function puzzleFromJSON(j: PuzzleJSON): Puzzle {
  const p: Puzzle = {
    id: j.id,
    rows: j.r,
    cols: j.c,
    blocked: decodeCells(j.b),
    waypoints: decodeCells(j.w),
    solution: decodeCells(j.s),
  }
  if (j.t) p.tier = j.t
  if (j.g) {
    p.grade = { maxLevel: j.g[0] as 1 | 2 | 3, l1: j.g[1], l2: j.g[2], l3: j.g[3], score: j.g[4] }
  }
  return p
}

/**
 * Checks that `route` is a valid full solution for the puzzle's board and
 * waypoints. Returns null when valid, otherwise a reason.
 */
export function checkRoute(
  p: Pick<Puzzle, 'rows' | 'cols' | 'blocked' | 'waypoints'>,
  route: readonly number[],
): string | null {
  const graph = buildGraph(p.rows, p.cols, p.blocked)
  if (route.length !== graph.size) return `route has ${route.length} squares, board has ${graph.size}`
  const seen = new Set<number>()
  for (const cell of route) {
    if (cell < 0 || cell >= p.rows * p.cols || graph.nodeOf[cell] < 0) return `bad square ${cell}`
    if (seen.has(cell)) return `square ${cell} visited twice`
    seen.add(cell)
  }
  for (let i = 1; i < route.length; i++) {
    if (!isKnightMove(p.cols, route[i - 1], route[i])) return `step ${i} is not a knight move`
  }
  if (p.waypoints.length < 2) return 'needs at least two waypoints'
  if (route[0] !== p.waypoints[0]) return 'must start on 1'
  if (route[route.length - 1] !== p.waypoints[p.waypoints.length - 1]) return 'must finish on the last number'
  let next = 0
  const wpIndex = new Map(p.waypoints.map((c, i) => [c, i]))
  for (const cell of route) {
    const w = wpIndex.get(cell)
    if (w !== undefined) {
      if (w !== next) return `number ${w + 1} visited out of order`
      next++
    }
  }
  if (next !== p.waypoints.length) return 'missed a number'
  return null
}
