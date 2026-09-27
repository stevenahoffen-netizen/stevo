// Generates all bundled puzzle content into src/data/*.json.
//   npx tsx scripts/generate-content.ts [--until YYYY-MM-DD] [--only tutorial]
//
// Deterministic: every puzzle comes from a seed derived from its date or slot.
// Variety rules: no layout ever repeats (up to rotation/reflection/reversal),
// no route repeats within 12 weeks, and no hole pattern dominates a board size.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  checkMove, generatePuzzle, holePatternKey, isDoomed, layoutKey, legalTargets, makeGame, makeRng, puzzleToJSON,
  routeKey, solveExact, PRACTICE_TIERS, TUTORIAL_TIERS, WEEKLY_TIERS, type Game, type Puzzle, type TierSpec,
} from '../src/engine'
import { addDays, EPOCH, daysBetween, weekdayIndex } from '../src/data/schedule'

const args = process.argv.slice(2)
const untilArg = args.indexOf('--until')
const UNTIL = untilArg >= 0 ? args[untilArg + 1] : '2027-12-31'
const onlyArg = args.indexOf('--only')
// The tutorial doesn't depend on the calendar, so it can be rebuilt on its own.
const TUTORIAL_ONLY = onlyArg >= 0 && args[onlyArg + 1] === 'tutorial'
const PRACTICE_PER_SIZE = 50
const ROUTE_SPACING_DAYS = 84
const MAX_PATTERN_SHARE = 0.12
const dataDir = resolve(import.meta.dirname, '../src/data')

const layouts = new Set<string>()
const routeLastUsed = new Map<string, number>()
const patternCount = new Map<string, number>()

let relaxed = 0

/**
 * Tries derived seeds until one passes `accept`. `accept` gets a strictness
 * level: 0 applies every variety rule; 1 is the fallback when a small board
 * has run through its viable hole patterns (layouts still never repeat).
 */
function gen(spec: TierSpec, seed: string, id: string, accept: (p: Puzzle, level: number) => boolean): Puzzle {
  for (let level = 0; level < 2; level++) {
    for (let k = 0; k < 60; k++) {
      const s = level === 0 && k === 0 ? seed : `${seed}#${level * 60 + k}`
      const { puzzle } = generatePuzzle(spec, makeRng(s), id)
      if (puzzle && !layouts.has(layoutKey(puzzle)) && accept(puzzle, level)) {
        layouts.add(layoutKey(puzzle))
        if (level > 0) relaxed++
        return puzzle
      }
    }
  }
  throw new Error(`could not generate ${id}`)
}

const t0 = Date.now()
if (!TUTORIAL_ONLY) {
  const days = daysBetween(EPOCH, UNTIL) + 1
  const perSize = new Map<number, number>()
  for (let i = 0; i < days; i++) perSize.set(WEEKLY_TIERS[i % 7].rows, (perSize.get(WEEKLY_TIERS[i % 7].rows) ?? 0) + 1)

  const dailies: Puzzle[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(EPOCH, i)
    const spec = WEEKLY_TIERS[weekdayIndex(day)]
    const cap = Math.max(4, Math.ceil(MAX_PATTERN_SHARE * (perSize.get(spec.rows) ?? 1)))
    const p = gen(spec, `knightline-daily-${day}`, `d-${day}`, (q, level) => {
      const last = routeLastUsed.get(routeKey(q))
      if (last !== undefined && i - last < ROUTE_SPACING_DAYS) return false
      return level > 0 || (patternCount.get(holePatternKey(q)) ?? 0) < cap
    })
    routeLastUsed.set(routeKey(p), i)
    patternCount.set(holePatternKey(p), (patternCount.get(holePatternKey(p)) ?? 0) + 1)
    dailies.push(p)
    if ((i + 1) % 50 === 0) console.log(`  dailies ${i + 1}/${days} (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
  writeFileSync(resolve(dataDir, 'dailies.json'), JSON.stringify({ epoch: EPOCH, puzzles: dailies.map(puzzleToJSON) }))
  console.log(`dailies: ${dailies.length} (${EPOCH} .. ${UNTIL}), ${relaxed} past the hole-pattern cap`)

  const practice: Record<string, ReturnType<typeof puzzleToJSON>[]> = {}
  for (const [size, spec] of Object.entries(PRACTICE_TIERS)) {
    practice[size] = Array.from({ length: PRACTICE_PER_SIZE }, (_, i) => {
      const p = gen(spec, `knightline-practice-${size}-${i}`, `p${size}-${i + 1}`, (q, level) => level > 0 || !routeLastUsed.has(routeKey(q)))
      routeLastUsed.set(routeKey(p), Number.MAX_SAFE_INTEGER / 2)
      return puzzleToJSON(p)
    })
  }
  writeFileSync(resolve(dataDir, 'practice.json'), JSON.stringify(practice))
  console.log(`practice: ${Object.values(practice).flat().length}`)
}

// ---------------------------------------------------------------- tutorial
/** Moves a wandering player can make after `route` before the board flags trouble. */
function failDepth(game: Game, route: number[], limit: number): number {
  if (isDoomed(game, route)) return 0
  if (limit === 0) return 1
  let worst = 0
  for (const t of legalTargets(game, route)) {
    worst = Math.max(worst, 1 + failDepth(game, [...route, t], limit - 1))
    if (worst > limit) break
  }
  return worst
}

const isCorner = (p: Puzzle, c: number) =>
  (c === 0 || c === p.cols - 1 || c === (p.rows - 1) * p.cols || c === p.rows * p.cols - 1)

interface TutorialScore {
  ok: boolean
  score: number
}

function tutorialScore(p: Puzzle, lesson: number, maxFail: number): TutorialScore {
  const game = makeGame(p)
  const sol = p.solution
  let maxGlow = 0
  let worstFail = 0
  let wrongOptions = 0
  let orderMoment = false
  let cornerMoment = false
  for (let i = 0; i < sol.length - 1; i++) {
    const route = sol.slice(0, i + 1)
    const legal = legalTargets(game, route)
    maxGlow = Math.max(maxGlow, legal.length)
    for (const t of legal) {
      if (t === sol[i + 1]) continue
      wrongOptions++
      worstFail = Math.max(worstFail, failDepth(game, [...route, t], maxFail + 1))
    }
    if (isCorner(p, sol[i + 1]) && legal.length >= 2) cornerMoment = true
    for (const n of game.neighbors.get(sol[i])!) {
      if (!route.includes(n) && checkMove(game, route, n) === 'order') orderMoment = true
    }
  }
  // At most three glowing squares, four on the bigger corners board.
  let ok = maxGlow <= (lesson === 2 ? 4 : 3) && worstFail <= maxFail
  if (lesson === 0) ok &&= wrongOptions >= 2 && wrongOptions <= 6
  if (lesson === 1) {
    // Numbers must matter: order comes up, and some middle number is needed for uniqueness.
    const middleNeeded = p.waypoints.slice(1, -1).some((w) => {
      const without = p.waypoints.filter((x) => x !== w)
      return solveExact({ ...p, waypoints: without }, { limit: 2 }).solutions.length >= 2
    })
    ok &&= orderMoment && middleNeeded && p.waypoints.length >= 3
  }
  // The corners lesson needs its corners open, and few enough numbers that the
  // player actually reasons about them.
  if (lesson === 2) ok &&= cornerMoment && !p.blocked.some((c) => isCorner(p, c)) && p.waypoints.length <= 6
  return { ok, score: wrongOptions + 2 * p.waypoints.length + 3 * worstFail }
}

const tutorial = TUTORIAL_TIERS.map((spec, lesson) => {
  for (const maxFail of [2, 3]) {
    let best: Puzzle | null = null
    let bestScore = Infinity
    for (let k = 0; k < 2000; k++) {
      const { puzzle } = generatePuzzle(spec, makeRng(`knightline-tutorial-${lesson}-${k}`), `t${lesson + 1}`)
      if (!puzzle) continue
      const s = tutorialScore(puzzle, lesson, maxFail)
      if (s.ok && s.score < bestScore) {
        best = puzzle
        bestScore = s.score
      }
    }
    if (best) {
      console.log(`tutorial ${lesson + 1}: ${best.rows}x${best.cols}, ${best.waypoints.length} numbers, score ${bestScore} (max fail depth ${maxFail})`)
      return puzzleToJSON(best)
    }
  }
  throw new Error(`no tutorial puzzle for lesson ${lesson + 1}`)
})
writeFileSync(resolve(dataDir, 'tutorial.json'), JSON.stringify(tutorial))
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
