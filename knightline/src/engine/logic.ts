// A human-style logic solver. It decides which knight jumps ("edges") are part
// of the route using sound deductions only, so a puzzle it fully solves has
// exactly one solution. The techniques it needed become the difficulty grade.
//
//   L1 forced     a square that needs two connections and has exactly two
//                 possible jumps uses both; a square with its connections
//                 rules out the rest (start and finish need one)
//   L2 structure  no jump may close a loop, join start to finish early, or put
//                 numbers out of order
//   L3 lookahead  assume a jump; if L1/L2 and a connectivity check break, the
//                 opposite is true

import { buildGraph, type Graph } from './board'
import type { Grade, Puzzle } from './puzzle'

export type Level = 1 | 2 | 3

export interface LogicResult {
  solved: boolean
  contradiction: boolean
  grade: Grade
  /** the route as cells, when solved */
  route: number[] | null
  /** node -> number of undecided jumps touching it (after solving) */
  undecided: number[]
  graph: Graph
}

interface Ctx {
  graph: Graph
  M: number
  edges: Array<[number, number]>
  inc: number[][]
  req: Uint8Array
  label: Int16Array
  K: number
  start: number
  end: number
}

interface St {
  es: Int8Array // 0 unknown, 1 on, -1 off
  on: Uint8Array
  unk: Uint8Array
}

interface Counts {
  l1: number
  l2: number
  l3: number
}

function makeCtx(p: Pick<Puzzle, 'rows' | 'cols' | 'blocked' | 'waypoints'>): Ctx {
  const graph = buildGraph(p.rows, p.cols, p.blocked)
  const M = graph.size
  const edges: Array<[number, number]> = []
  const inc: number[][] = Array.from({ length: M }, () => [])
  for (let v = 0; v < M; v++) {
    for (const u of graph.adj[v]) {
      if (u > v) {
        inc[v].push(edges.length)
        inc[u].push(edges.length)
        edges.push([v, u])
      }
    }
  }
  const label = new Int16Array(M)
  p.waypoints.forEach((cell, i) => {
    label[graph.nodeOf[cell]] = i + 1
  })
  const start = graph.nodeOf[p.waypoints[0]]
  const end = graph.nodeOf[p.waypoints[p.waypoints.length - 1]]
  const req = new Uint8Array(M).fill(2)
  req[start] = 1
  req[end] = 1
  return { graph, M, edges, inc, req, label, K: p.waypoints.length, start, end }
}

function initState(ctx: Ctx): St {
  const on = new Uint8Array(ctx.M)
  const unk = new Uint8Array(ctx.M)
  for (let v = 0; v < ctx.M; v++) unk[v] = ctx.inc[v].length
  return { es: new Int8Array(ctx.edges.length), on, unk }
}

function cloneState(st: St): St {
  return { es: st.es.slice(), on: st.on.slice(), unk: st.unk.slice() }
}

function setEdge(ctx: Ctx, st: St, e: number, val: 1 | -1) {
  const [u, v] = ctx.edges[e]
  st.es[e] = val
  st.unk[u]--
  st.unk[v]--
  if (val === 1) {
    st.on[u]++
    st.on[v]++
  }
}

const CONTRADICTION = -1

/** L1 to a fixpoint. Returns number of firings, or CONTRADICTION. */
function l1Pass(ctx: Ctx, st: St): number {
  let fired = 0
  let changed = true
  while (changed) {
    changed = false
    for (let v = 0; v < ctx.M; v++) {
      const need = ctx.req[v]
      const on = st.on[v]
      const unk = st.unk[v]
      if (on > need || on + unk < need) return CONTRADICTION
      if (unk === 0) continue
      if (on === need) {
        for (const e of ctx.inc[v]) if (st.es[e] === 0) setEdge(ctx, st, e, -1)
      } else if (on + unk === need) {
        for (const e of ctx.inc[v]) if (st.es[e] === 0) setEdge(ctx, st, e, 1)
      } else {
        continue
      }
      fired++
      changed = true
    }
  }
  return fired
}

interface Chains {
  chainOf: Int16Array
  /** chain -> [endA, endB] (equal for a single square) */
  ends: Array<[number, number]>
  /** chain -> waypoint labels in order from endA to endB */
  labels: number[][]
  size: number[]
  cycle: boolean
}

function onNeighbor(ctx: Ctx, st: St, v: number, prev: number): number {
  for (const e of ctx.inc[v]) {
    if (st.es[e] !== 1) continue
    const [a, b] = ctx.edges[e]
    const other = a === v ? b : a
    if (other !== prev) return other
  }
  return -1
}

function computeChains(ctx: Ctx, st: St): Chains {
  const chainOf = new Int16Array(ctx.M).fill(-1)
  const ends: Array<[number, number]> = []
  const labels: number[][] = []
  const size: number[] = []
  for (let v = 0; v < ctx.M; v++) {
    if (chainOf[v] >= 0 || st.on[v] > 1) continue
    const id = ends.length
    const labs: number[] = []
    let prev = -1
    let cur = v
    let n = 0
    let last = v
    while (cur >= 0) {
      chainOf[cur] = id
      n++
      if (ctx.label[cur]) labs.push(ctx.label[cur])
      last = cur
      const nxt = onNeighbor(ctx, st, cur, prev)
      prev = cur
      cur = nxt
    }
    ends.push([v, last])
    labels.push(labs)
    size.push(n)
  }
  let cycle = false
  for (let v = 0; v < ctx.M; v++) if (chainOf[v] < 0) cycle = true
  return { chainOf, ends, labels, size, cycle }
}

/** Would switching on the jump u-v break the route's structure? */
function violatesStructure(ctx: Ctx, ch: Chains, u: number, v: number): boolean {
  const cu = ch.chainOf[u]
  const cv = ch.chainOf[v]
  if (cu === cv) return true // closes a loop
  const la = ch.ends[cu][1] === u ? ch.labels[cu] : [...ch.labels[cu]].reverse()
  const lb = ch.ends[cv][0] === v ? ch.labels[cv] : [...ch.labels[cv]].reverse()
  const combined = la.concat(lb)
  if (combined.length >= 2) {
    const d = combined[1] - combined[0]
    if (d !== 1 && d !== -1) return true
    for (let i = 2; i < combined.length; i++) {
      if (combined[i] - combined[i - 1] !== d) return true
    }
  }
  const hasStart = combined.includes(1)
  const hasEnd = combined.includes(ctx.K)
  if (hasStart && hasEnd && ch.size[cu] + ch.size[cv] !== ctx.M) return true
  return false
}

/** L2 single pass. Returns eliminations, or CONTRADICTION. */
function l2Pass(ctx: Ctx, st: St): number {
  const ch = computeChains(ctx, st)
  if (ch.cycle) return CONTRADICTION
  let eliminated = 0
  for (let e = 0; e < ctx.edges.length; e++) {
    if (st.es[e] !== 0) continue
    const [u, v] = ctx.edges[e]
    if (st.on[u] >= ctx.req[u] || st.on[v] >= ctx.req[v]) continue
    if (violatesStructure(ctx, ch, u, v)) {
      setEdge(ctx, st, e, -1)
      eliminated++
    }
  }
  return eliminated
}

function connected(ctx: Ctx, st: St): boolean {
  const seen = new Uint8Array(ctx.M)
  const stack = [0]
  seen[0] = 1
  let count = 1
  while (stack.length) {
    const v = stack.pop()!
    for (const e of ctx.inc[v]) {
      if (st.es[e] === -1) continue
      const [a, b] = ctx.edges[e]
      const u = a === v ? b : a
      if (!seen[u]) {
        seen[u] = 1
        count++
        stack.push(u)
      }
    }
  }
  return count === ctx.M
}

function allDecided(st: St): boolean {
  for (let i = 0; i < st.es.length; i++) if (st.es[i] === 0) return false
  return true
}

/** Walks the on-edges from the start. Returns node route or null if not a valid full route. */
function extractRoute(ctx: Ctx, st: St): number[] | null {
  const route: number[] = []
  let prev = -1
  let cur = ctx.start
  while (cur >= 0 && route.length <= ctx.M) {
    route.push(cur)
    const nxt = onNeighbor(ctx, st, cur, prev)
    prev = cur
    cur = nxt
  }
  if (route.length !== ctx.M || route[route.length - 1] !== ctx.end) return null
  let next = 1
  for (const v of route) {
    if (ctx.label[v]) {
      if (ctx.label[v] !== next) return null
      next++
    }
  }
  return next === ctx.K + 1 ? route : null
}

/** Applies L1 (and L2 if allowed) to a fixpoint. Returns false on contradiction. */
function propagate(ctx: Ctx, st: St, level: Level, counts: Counts): boolean {
  for (;;) {
    const f1 = l1Pass(ctx, st)
    if (f1 === CONTRADICTION) return false
    counts.l1 += f1
    if (level >= 2) {
      const f2 = l2Pass(ctx, st)
      if (f2 === CONTRADICTION) return false
      counts.l2 += f2
      if (f2 > 0) continue
    }
    break
  }
  if (!connected(ctx, st)) return false
  if (allDecided(st) && !extractRoute(ctx, st)) return false
  return true
}

/** One lookahead deduction. Returns true if it decided an edge. */
function lookahead(ctx: Ctx, st: St): boolean {
  const scratch: Counts = { l1: 0, l2: 0, l3: 0 }
  for (let e = 0; e < ctx.edges.length; e++) {
    if (st.es[e] !== 0) continue
    for (const val of [1, -1] as const) {
      const trial = cloneState(st)
      setEdge(ctx, trial, e, val)
      if (!propagate(ctx, trial, 2, scratch)) {
        setEdge(ctx, st, e, val === 1 ? -1 : 1)
        return true
      }
    }
  }
  return false
}

export function scoreGrade(M: number, c: Counts): number {
  return Math.round(M + 0.5 * c.l2 + 8 * c.l3)
}

export function solveLogic(
  p: Pick<Puzzle, 'rows' | 'cols' | 'blocked' | 'waypoints'>,
  maxLevel: Level = 3,
): LogicResult {
  const ctx = makeCtx(p)
  const st = initState(ctx)
  const counts: Counts = { l1: 0, l2: 0, l3: 0 }
  let ok = propagate(ctx, st, maxLevel >= 2 ? 2 : 1, counts)
  while (ok && !allDecided(st) && maxLevel >= 3) {
    if (!lookahead(ctx, st)) break
    counts.l3++
    ok = propagate(ctx, st, 2, counts)
  }
  const route = ok && allDecided(st) ? extractRoute(ctx, st) : null
  const undecided = Array.from({ length: ctx.M }, (_, v) => st.unk[v])
  const used: 1 | 2 | 3 = counts.l3 > 0 ? 3 : counts.l2 > 0 ? 2 : 1
  return {
    solved: route !== null,
    contradiction: !ok,
    grade: { maxLevel: used, l1: counts.l1, l2: counts.l2, l3: counts.l3, score: scoreGrade(ctx.M, counts) },
    route: route ? route.map((n) => ctx.graph.cellOf[n]) : null,
    undecided,
    graph: ctx.graph,
  }
}

/**
 * Soundness helper for tests: runs propagation (L1+L2, plus lookahead if
 * maxLevel is 3) and returns the edge decisions as cell pairs.
 */
export function deduceEdges(
  p: Pick<Puzzle, 'rows' | 'cols' | 'blocked' | 'waypoints'>,
  maxLevel: Level,
): { contradiction: boolean; on: Array<[number, number]>; off: Array<[number, number]> } {
  const ctx = makeCtx(p)
  const st = initState(ctx)
  const counts: Counts = { l1: 0, l2: 0, l3: 0 }
  let ok = propagate(ctx, st, maxLevel >= 2 ? 2 : 1, counts)
  while (ok && !allDecided(st) && maxLevel >= 3) {
    if (!lookahead(ctx, st)) break
    ok = propagate(ctx, st, 2, counts)
  }
  const on: Array<[number, number]> = []
  const off: Array<[number, number]> = []
  ctx.edges.forEach(([a, b], e) => {
    const pair: [number, number] = [ctx.graph.cellOf[a], ctx.graph.cellOf[b]]
    if (st.es[e] === 1) on.push(pair)
    else if (st.es[e] === -1) off.push(pair)
  })
  return { contradiction: !ok, on, off }
}
