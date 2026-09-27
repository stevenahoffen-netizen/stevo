// Re-proves every bundled puzzle: valid route, exactly one solution (exhaustive
// search), solvable by the logic solver at its tier's level, symmetric holes.
import { checkRoute, solveExact, solveLogic, PRACTICE_TIERS, WEEKLY_TIERS, TUTORIAL_TIERS, type Puzzle } from '../src/engine'
import { weekdayIndex } from '../src/data/schedule'
import { loadContent } from './content'

const { dailies, practice, tutorial } = loadContent()
const errors: string[] = []
const seenBoards = new Set<string>()
let checked = 0
const t0 = Date.now()

function validate(p: Puzzle, maxLevel: 1 | 2 | 3) {
  checked++
  const bad = (msg: string) => errors.push(`${p.id}: ${msg}`)
  const r = checkRoute(p, p.solution)
  if (r) bad(`solution invalid: ${r}`)
  const ex = solveExact(p, { limit: 2, maxNodes: 20_000_000 })
  if (!ex.complete) bad('exact search incomplete')
  if (ex.solutions.length !== 1) bad(`${ex.solutions.length} solutions`)
  const lg = solveLogic(p, maxLevel)
  if (!lg.solved) bad(`not logic-solvable at L${maxLevel}`)
  else if (lg.route!.join() !== p.solution.join()) bad('logic route differs')
  const n = p.rows * p.cols
  for (const b of p.blocked) if (!p.blocked.includes(n - 1 - b)) bad('holes not symmetric')
  const key = `${p.rows}x${p.cols}|${p.blocked.join(',')}|${p.waypoints.join(',')}`
  if (seenBoards.has(key)) bad('duplicate puzzle')
  seenBoards.add(key)
}

for (const p of dailies) validate(p, WEEKLY_TIERS[weekdayIndex(p.id.slice(2))].maxLevel)
for (const [size, list] of Object.entries(practice)) for (const p of list) validate(p, PRACTICE_TIERS[size as '5'].maxLevel)
tutorial.forEach((p, i) => validate(p, TUTORIAL_TIERS[i].maxLevel))

console.log(`checked ${checked} puzzles in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
if (errors.length) {
  console.error(`${errors.length} problems:\n` + errors.slice(0, 50).join('\n'))
  process.exit(1)
}
console.log('all puzzles valid and unique')
