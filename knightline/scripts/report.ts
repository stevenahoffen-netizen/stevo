// Difficulty and variety report for bundled content.
//   npx tsx scripts/report.ts
import { holePatternKey, layoutKey, playMetrics, routeKey, type Puzzle } from '../src/engine'
import { WEEKDAY_NAMES, weekdayIndex } from '../src/data/schedule'
import { loadContent, renderAscii } from './content'

const { dailies, practice, tutorial } = loadContent()
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1)
const range = (xs: number[]) => `${Math.min(...xs)}-${Math.max(...xs)}`
const rangeF = (xs: number[]) => `${Math.min(...xs).toFixed(1)}-${Math.max(...xs).toFixed(1)}`

function row(label: string, ps: Puzzle[]) {
  const ms = ps.map(playMetrics)
  const cols = [
    label.padEnd(10),
    String(ps.length).padStart(4),
    avg(ps.map((p) => p.solution.length)).padStart(8),
    avg(ps.map((p) => p.blocked.length)).padStart(6),
    `${avg(ps.map((p) => p.waypoints.length))} (${range(ps.map((p) => p.waypoints.length))})`.padStart(12),
    `${avg(ms.map((m) => m.bits))} (${rangeF(ms.map((m) => m.bits))})`.padStart(17),
    avg(ms.map((m) => m.decisions)).padStart(10),
    avg(ms.map((m) => m.firstChoices)).padStart(7),
    avg(ms.map((m) => m.oneGlowShare * 100)).padStart(8),
    avg(ps.map((p) => p.grade!.l3)).padStart(6),
  ]
  console.log(cols.join(' '))
}

console.log(
  ['slot'.padEnd(10), 'n'.padStart(4), 'squares'.padStart(8), 'holes'.padStart(6), 'numbers'.padStart(12), 'bits'.padStart(17), 'decisions'.padStart(10), 'first'.padStart(7), '1-glow%'.padStart(8), 'l3'.padStart(6)].join(' '),
)
for (let w = 0; w < 7; w++) {
  const ps = dailies.filter((p) => weekdayIndex(p.id.slice(2)) === w)
  row(`${WEEKDAY_NAMES[w].slice(0, 3)} ${ps[0].rows}x${ps[0].cols}`, ps)
}
for (const [size, ps] of Object.entries(practice)) row(`prac ${size}x${size}`, ps)

// Variety: repeats up to rotation, reflection and reversal.
const all = [...dailies, ...Object.values(practice).flat()]
const layouts = new Set(all.map(layoutKey))
const routes = new Set(dailies.map(routeKey))
console.log(`\nlayouts: ${layouts.size} distinct of ${all.length}; daily routes: ${routes.size} distinct of ${dailies.length}`)
for (const size of [5, 6, 7]) {
  const ps = dailies.filter((p) => p.rows === size)
  const counts = new Map<string, number>()
  for (const p of ps) counts.set(holePatternKey(p), (counts.get(holePatternKey(p)) ?? 0) + 1)
  const top = [...counts.values()].sort((a, b) => b - a)[0]
  console.log(`${size}x${size} dailies: ${counts.size} hole patterns, most common ${((top / ps.length) * 100).toFixed(0)}%`)
}

console.log('\ntutorial:')
for (const p of tutorial) console.log(`${p.id} ${p.rows}x${p.cols}\n${renderAscii(p)}\n`)
console.log('sample dailies (first week):')
for (const p of dailies.slice(0, 7)) console.log(`${p.id} ${p.tier} bits ${p.grade!.score}\n${renderAscii(p)}\n`)
