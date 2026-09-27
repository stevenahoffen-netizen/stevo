// Board symmetries, so content checks can treat a rotated or mirrored puzzle
// (or the same route walked backwards) as a repeat.

type Transform = (r: number, c: number) => [number, number]

export function transforms(rows: number, cols: number): Transform[] {
  const R = rows - 1
  const C = cols - 1
  const ts: Transform[] = [
    (r, c) => [r, c],
    (r, c) => [r, C - c],
    (r, c) => [R - r, c],
    (r, c) => [R - r, C - c],
  ]
  if (rows === cols) {
    ts.push(
      (r, c) => [c, r],
      (r, c) => [c, R - r],
      (r, c) => [C - c, r],
      (r, c) => [C - c, R - r],
    )
  }
  return ts
}

function mapCells(cells: readonly number[], cols: number, t: Transform): number[] {
  return cells.map((cell) => {
    const [r, c] = t(Math.floor(cell / cols), cell % cols)
    return r * cols + c
  })
}

/** Same board and numbers under any rotation/reflection, in either direction. */
export function layoutKey(p: { rows: number; cols: number; blocked: readonly number[]; waypoints: readonly number[] }): string {
  let best = ''
  for (const t of transforms(p.rows, p.cols)) {
    const blocked = mapCells(p.blocked, p.cols, t).sort((a, b) => a - b).join(',')
    for (const wp of [p.waypoints, [...p.waypoints].reverse()]) {
      const key = `${p.rows}x${p.cols}|${blocked}|${mapCells(wp, p.cols, t).join(',')}`
      if (!best || key < best) best = key
    }
  }
  return best
}

/** Same route under any rotation/reflection, walked either way. */
export function routeKey(p: { rows: number; cols: number; solution: readonly number[] }): string {
  let best = ''
  for (const t of transforms(p.rows, p.cols)) {
    for (const route of [p.solution, [...p.solution].reverse()]) {
      const key = `${p.rows}x${p.cols}|${mapCells(route, p.cols, t).join(',')}`
      if (!best || key < best) best = key
    }
  }
  return best
}

/** Blocked-square pattern up to symmetry. */
export function holePatternKey(p: { rows: number; cols: number; blocked: readonly number[] }): string {
  let best = ''
  for (const t of transforms(p.rows, p.cols)) {
    const key = `${p.rows}x${p.cols}|${mapCells(p.blocked, p.cols, t).sort((a, b) => a - b).join(',')}`
    if (!best || key < best) best = key
  }
  return best
}
