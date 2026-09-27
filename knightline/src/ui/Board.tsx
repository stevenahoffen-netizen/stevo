import { memo, useCallback, useRef, type KeyboardEvent } from 'react'
import type { Puzzle } from '../engine/puzzle'
import { squareLabel } from '../game/format'
import { KNIGHT } from './icons'

export interface BoardProps {
  puzzle: Puzzle
  route: readonly number[]
  targets: ReadonlySet<number>
  /** squares the route has already doomed (cut off or dead ends) */
  doomed: ReadonlySet<number>
  exits: ReadonlyMap<number, number> | null
  hintCell: number | null
  shakeCell: number | null
  solved: boolean
  showSteps: boolean
  /** squares to outline (tutorial teaching aid) */
  emphasize?: ReadonlySet<number>
  /** bumps to replay the solve animation */
  celebrate: number
  onTap(cell: number): void
}

function BoardImpl(props: BoardProps) {
  const { puzzle, route, targets, doomed, exits, hintCell, shakeCell, solved, showSteps, emphasize, celebrate, onTap } = props
  const { rows, cols } = puzzle
  const blocked = new Set(puzzle.blocked)
  const wpIndex = new Map(puzzle.waypoints.map((c, i) => [c, i]))
  const finish = puzzle.waypoints[puzzle.waypoints.length - 1]
  const stepOf = new Map(route.map((c, i) => [c, i]))
  const head = route[route.length - 1]
  const cells = Array.from({ length: rows * cols }, (_, i) => i)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])

  const center = (cell: number) => [(cell % cols) + 0.5, Math.floor(cell / cols) + 0.5] as const

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const el = e.target as HTMLElement
      const cell = Number(el.dataset.cell)
      if (Number.isNaN(cell)) return
      const dir: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      }
      const d = dir[e.key]
      if (!d) return
      let r = Math.floor(cell / cols) + d[0]
      let c = (cell % cols) + d[1]
      // Skip blocked squares (they aren't focusable).
      while (r >= 0 && r < rows && c >= 0 && c < cols) {
        const next = buttons.current[r * cols + c]
        if (next) {
          e.preventDefault()
          next.focus()
          return
        }
        r += d[0]
        c += d[1]
      }
    },
    [rows, cols],
  )

  const label = (cell: number) => {
    const parts = [squareLabel(cell, rows, cols)]
    if (blocked.has(cell)) return `${parts[0]}, blocked`
    const w = wpIndex.get(cell)
    if (w !== undefined) parts.push(cell === finish ? `number ${w + 1}, the finish` : `number ${w + 1}`)
    const step = stepOf.get(cell)
    if (cell === head) parts.push('knight is here')
    else if (step !== undefined) parts.push(`visited, tap to rewind here`)
    else if (targets.has(cell)) parts.push('can jump here')
    if (doomed.has(cell)) parts.push('dead end')
    return parts.join(', ')
  }

  return (
    <div className="board-frame" data-solved={solved || undefined}>
      <div className="board" style={{ ['--cols' as string]: cols, ['--rows' as string]: rows, aspectRatio: `${cols} / ${rows}` }}>
        <div className="layer squares" aria-hidden="true">
          {cells.map((cell) => {
            const r = Math.floor(cell / cols)
            const c = cell % cols
            const cls = ['sq', (r + c) % 2 === 1 ? 'dark' : 'light']
            if (blocked.has(cell)) cls.push('blocked')
            else if (stepOf.has(cell)) cls.push('visited')
            if (doomed.has(cell)) cls.push('doomed')
            return (
              <div key={cell} className={cls.join(' ')}>
                {c === 0 && <span className="coord rank">{rows - r}</span>}
                {r === rows - 1 && <span className="coord file">{String.fromCharCode(97 + c)}</span>}
              </div>
            )
          })}
        </div>

        <svg className="layer route" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden="true" key={`route-${celebrate}`}>
          {route.slice(1).map((cell, i) => {
            const [x1, y1] = center(route[i])
            const [x2, y2] = center(cell)
            const age = route.length - 2 - i
            // Knight routes cross a lot: keep the recent trail bold and let
            // older jumps recede so the player can see where they just went.
            const fade = age < 3 ? 1 : Math.max(0.3, 1 - (age - 2) * 0.1)
            return (
              <line
                key={`${route[i]}-${cell}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                pathLength={1}
                className={age === 0 && !solved ? 'seg latest' : 'seg'}
                style={solved ? { animationDelay: `${i * 28}ms` } : { opacity: fade, strokeWidth: age < 3 ? 0.085 : 0.06 }}
              />
            )
          })}
        </svg>

        <div className="layer pieces" role="group" aria-label="Board" onKeyDown={onKeyDown}>
          {cells.map((cell) => {
            if (blocked.has(cell)) return <div key={cell} className="piece blocked" role="img" aria-label={label(cell)} />
            const w = wpIndex.get(cell)
            const step = stepOf.get(cell)
            const isHead = cell === head
            const cls = ['piece']
            if (targets.has(cell)) cls.push(w !== undefined ? 'target target-wp' : 'target')
            if (cell === hintCell) cls.push('hinted')
            if (cell === shakeCell) cls.push('shake')
            if (step !== undefined) cls.push('visited')
            if (emphasize?.has(cell) && step === undefined) cls.push('emphasis')
            const exit = exits?.get(cell)
            return (
              <button
                key={cell}
                ref={(el) => {
                  buttons.current[cell] = el
                }}
                type="button"
                className={cls.join(' ')}
                data-cell={cell}
                data-testid={`cell-${cell}`}
                tabIndex={isHead ? 0 : -1}
                aria-label={label(cell)}
                onClick={() => onTap(cell)}
              >
                {w !== undefined && !isHead && <span className={cell === finish ? 'wp finish' : 'wp'}>{w + 1}</span>}
                {isHead && (
                  <span className="knight">
                    <span className="glyph">{KNIGHT}</span>
                    {w !== undefined && <span className="knight-num">{w + 1}</span>}
                  </span>
                )}
                {showSteps && step !== undefined && !isHead && w === undefined && <span className="step">{step + 1}</span>}
                {exit !== undefined && <span className="exits">{exit}</span>}
                {doomed.has(cell) && <span className="cut" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const Board = memo(BoardImpl)
