// Board geometry and the knight graph over open squares.
// Cells are numbered row-major: cell = row * cols + col.

export const KNIGHT_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
]

export function rowOf(cell: number, cols: number): number {
  return Math.floor(cell / cols)
}

export function colOf(cell: number, cols: number): number {
  return cell % cols
}

export function isKnightMove(cols: number, a: number, b: number): boolean {
  const dr = Math.abs(rowOf(a, cols) - rowOf(b, cols))
  const dc = Math.abs(colOf(a, cols) - colOf(b, cols))
  return (dr === 1 && dc === 2) || (dr === 2 && dc === 1)
}

/** Knight moves from `cell` that stay on the board (ignores blocked squares). */
export function knightTargets(rows: number, cols: number, cell: number): number[] {
  const r = rowOf(cell, cols)
  const c = colOf(cell, cols)
  const out: number[] = []
  for (const [dr, dc] of KNIGHT_DELTAS) {
    const nr = r + dr
    const nc = c + dc
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc)
  }
  return out
}

/**
 * The knight graph restricted to open squares. Solvers work in "node" space
 * (0..n-1, open squares only); the UI works in "cell" space.
 */
export interface Graph {
  readonly rows: number
  readonly cols: number
  /** node -> cell */
  readonly cellOf: readonly number[]
  /** cell -> node, or -1 for blocked squares */
  readonly nodeOf: Int16Array
  /** node -> neighbouring nodes */
  readonly adj: readonly (readonly number[])[]
  readonly size: number
}

export function buildGraph(rows: number, cols: number, blocked: Iterable<number>): Graph {
  const blockedSet = new Set(blocked)
  const nodeOf = new Int16Array(rows * cols).fill(-1)
  const cellOf: number[] = []
  for (let cell = 0; cell < rows * cols; cell++) {
    if (!blockedSet.has(cell)) {
      nodeOf[cell] = cellOf.length
      cellOf.push(cell)
    }
  }
  const adj = cellOf.map((cell) =>
    knightTargets(rows, cols, cell)
      .map((t) => nodeOf[t])
      .filter((n) => n >= 0),
  )
  return { rows, cols, cellOf, nodeOf, adj, size: cellOf.length }
}

/** True if every open square can reach every other by knight moves. */
export function isConnected(graph: Graph): boolean {
  if (graph.size === 0) return true
  const seen = new Uint8Array(graph.size)
  const stack = [0]
  seen[0] = 1
  let count = 1
  while (stack.length) {
    const v = stack.pop()!
    for (const u of graph.adj[v]) {
      if (!seen[u]) {
        seen[u] = 1
        count++
        stack.push(u)
      }
    }
  }
  return count === graph.size
}

/** Square colour (0 light, 1 dark). A knight always changes colour. */
export function colorOf(cell: number, cols: number): number {
  return (rowOf(cell, cols) + colOf(cell, cols)) & 1
}
