// Loads bundled content for scripts.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { puzzleFromJSON, type Puzzle, type PuzzleJSON } from '../src/engine'

const dataDir = resolve(import.meta.dirname, '../src/data')
const read = (f: string) => JSON.parse(readFileSync(resolve(dataDir, f), 'utf8'))

export function loadContent() {
  const d = read('dailies.json') as { epoch: string; puzzles: PuzzleJSON[] }
  const practice = read('practice.json') as Record<string, PuzzleJSON[]>
  const tutorial = read('tutorial.json') as PuzzleJSON[]
  return {
    epoch: d.epoch,
    dailies: d.puzzles.map(puzzleFromJSON),
    practice: Object.fromEntries(Object.entries(practice).map(([k, v]) => [k, v.map(puzzleFromJSON)])) as Record<string, Puzzle[]>,
    tutorial: tutorial.map(puzzleFromJSON),
  }
}

export function renderAscii(p: Puzzle): string {
  const wp = new Map(p.waypoints.map((c, i) => [c, i + 1]))
  const lines: string[] = []
  for (let r = 0; r < p.rows; r++) {
    let line = ''
    for (let c = 0; c < p.cols; c++) {
      const cell = r * p.cols + c
      line += p.blocked.includes(cell) ? ' ##' : wp.has(cell) ? String(wp.get(cell)).padStart(3) : '  .'
    }
    lines.push(line)
  }
  return lines.join('\n')
}
