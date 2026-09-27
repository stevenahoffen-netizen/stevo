// Generates all bundled puzzle content into src/data/*.json.
//   npx tsx scripts/generate-content.ts [--until YYYY-MM-DD]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  generatePuzzle, makeRng, puzzleToJSON, PRACTICE_TIERS, TUTORIAL_TIERS, WEEKLY_TIERS,
  type Puzzle, type TierSpec,
} from '../src/engine'
import { addDays, EPOCH, daysBetween, weekdayIndex } from '../src/data/schedule'

const args = process.argv.slice(2)
const untilArg = args.indexOf('--until')
const UNTIL = untilArg >= 0 ? args[untilArg + 1] : '2027-12-31'
const PRACTICE_PER_SIZE = 50
const dataDir = resolve(import.meta.dirname, '../src/data')

const seen = new Set<string>()
const boardKey = (p: Puzzle) => `${p.rows}x${p.cols}|${p.blocked.join(',')}|${p.waypoints.join(',')}`

function gen(spec: TierSpec, seed: string, id: string): Puzzle {
  // Retry with derived seeds if a seed is unlucky or repeats an earlier
  // puzzle; stays deterministic.
  for (let k = 0; k < 20; k++) {
    const { puzzle } = generatePuzzle(spec, makeRng(k === 0 ? seed : `${seed}#${k}`), id)
    if (puzzle && !seen.has(boardKey(puzzle))) {
      seen.add(boardKey(puzzle))
      return puzzle
    }
  }
  throw new Error(`could not generate ${id}`)
}

const t0 = Date.now()
const days = daysBetween(EPOCH, UNTIL) + 1
const dailies: Puzzle[] = []
for (let i = 0; i < days; i++) {
  const day = addDays(EPOCH, i)
  dailies.push(gen(WEEKLY_TIERS[weekdayIndex(day)], `knightline-daily-${day}`, `d-${day}`))
  if ((i + 1) % 50 === 0) console.log(`  dailies ${i + 1}/${days} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}
writeFileSync(
  resolve(dataDir, 'dailies.json'),
  JSON.stringify({ epoch: EPOCH, puzzles: dailies.map(puzzleToJSON) }),
)
console.log(`dailies: ${dailies.length} (${EPOCH} .. ${UNTIL})`)

const practice: Record<string, ReturnType<typeof puzzleToJSON>[]> = {}
for (const [size, spec] of Object.entries(PRACTICE_TIERS)) {
  practice[size] = Array.from({ length: PRACTICE_PER_SIZE }, (_, i) =>
    puzzleToJSON(gen(spec, `knightline-practice-${size}-${i}`, `p${size}-${i + 1}`)),
  )
}
writeFileSync(resolve(dataDir, 'practice.json'), JSON.stringify(practice))
console.log(`practice: ${Object.values(practice).flat().length}`)

// Tutorial: pick the candidate with the fewest numbers from a few seeds.
const tutorial = TUTORIAL_TIERS.map((spec, i) => {
  let best: Puzzle | null = null
  for (let k = 0; k < 40; k++) {
    const { puzzle } = generatePuzzle(spec, makeRng(`knightline-tutorial-${i}-${k}`), `t${i + 1}`)
    if (puzzle && (!best || puzzle.waypoints.length < best.waypoints.length)) best = puzzle
  }
  if (!best) throw new Error(`no tutorial puzzle ${i}`)
  return puzzleToJSON(best)
})
writeFileSync(resolve(dataDir, 'tutorial.json'), JSON.stringify(tutorial))
console.log(`tutorial: ${tutorial.length}`)
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
