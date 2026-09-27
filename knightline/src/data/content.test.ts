import { describe, expect, it } from 'vitest'
import dailiesJson from './dailies.json'
import practiceJson from './practice.json'
import tutorialJson from './tutorial.json'
import { checkRoute, puzzleFromJSON, solveExact, solveLogic, type PuzzleJSON } from '../engine'
import { EPOCH, addDays, puzzleNumber, weekdayIndex } from './schedule'

const dailies = (dailiesJson.puzzles as unknown as PuzzleJSON[]).map(puzzleFromJSON)
const practice = Object.values(practiceJson as unknown as Record<string, PuzzleJSON[]>).flat().map(puzzleFromJSON)
const tutorial = (tutorialJson as unknown as PuzzleJSON[]).map(puzzleFromJSON)

describe('bundled content', () => {
  it('has one daily per day starting at the epoch, Monday first', () => {
    expect(dailiesJson.epoch).toBe(EPOCH)
    expect(weekdayIndex(EPOCH)).toBe(0)
    dailies.forEach((p, i) => expect(p.id).toBe(`d-${addDays(EPOCH, i)}`))
    expect(puzzleNumber(EPOCH)).toBe(1)
  })

  it('every puzzle is valid, unique and logic-solvable', () => {
    const keys = new Set<string>()
    for (const p of [...dailies, ...practice, ...tutorial]) {
      expect(checkRoute(p, p.solution), p.id).toBeNull()
      const ex = solveExact(p, { limit: 2, maxNodes: 20_000_000 })
      expect(ex.complete, p.id).toBe(true)
      expect(ex.solutions.length, p.id).toBe(1)
      const lg = solveLogic(p, 3)
      expect(lg.solved, p.id).toBe(true)
      const key = `${p.rows}x${p.cols}|${p.blocked}|${p.waypoints}`
      expect(keys.has(key), p.id).toBe(false)
      keys.add(key)
    }
  })

  it('follows the weekly curve', () => {
    const sizes = [5, 5, 6, 6, 6, 7, 7]
    for (const p of dailies) expect(p.rows).toBe(sizes[weekdayIndex(p.id.slice(2))])
  })
})
