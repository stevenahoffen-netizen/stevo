// Difficulty report for bundled content.
import { WEEKDAY_NAMES, weekdayIndex } from '../src/data/schedule'
import { loadContent, renderAscii } from './content'

const { dailies, practice, tutorial } = loadContent()
const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1)
const range = (xs: number[]) => `${Math.min(...xs)}-${Math.max(...xs)}`

console.log('weekday   n  squares  holes   numbers      l2          l3          score')
for (let w = 0; w < 7; w++) {
  const ps = dailies.filter((p) => weekdayIndex(p.id.slice(2)) === w)
  const M = ps.map((p) => p.solution.length)
  const H = ps.map((p) => p.blocked.length)
  const W = ps.map((p) => p.waypoints.length)
  const L2 = ps.map((p) => p.grade!.l2)
  const L3 = ps.map((p) => p.grade!.l3)
  const S = ps.map((p) => p.grade!.score)
  console.log(
    `${WEEKDAY_NAMES[w].slice(0, 3).padEnd(8)}${String(ps.length).padStart(3)}  ${avg(M).padStart(5)}  ${avg(H).padStart(5)}  ${avg(W).padStart(5)} (${range(W)})  ${avg(L2).padStart(5)} (${range(L2)})  ${avg(L3).padStart(4)} (${range(L3)})  ${avg(S).padStart(5)} (${range(S)})`,
  )
}
for (const [size, ps] of Object.entries(practice)) {
  console.log(`practice ${size}x${size}: ${ps.length}, numbers ${avg(ps.map((p) => p.waypoints.length))}, l3 ${avg(ps.map((p) => p.grade!.l3))}, score ${avg(ps.map((p) => p.grade!.score))}`)
}
console.log('\ntutorial:')
for (const p of tutorial) console.log(`${p.id} ${p.rows}x${p.cols}\n${renderAscii(p)}\n`)
console.log('sample dailies (first week):')
for (const p of dailies.slice(0, 7)) console.log(`${p.id} ${p.tier} ${JSON.stringify(p.grade)}\n${renderAscii(p)}\n`)
