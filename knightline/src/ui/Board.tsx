import { memo, useCallback, useRef, type KeyboardEvent } from 'react'
import type { Puzzle } from '../engine/puzzle'
import { squareName } from '../game/format'
import { KNIGHT } from './icons'

export interface BoardProps {
  puzzle: Puzzle
  route: readonly number[]
  targets: ReadonlySet<number>
  stranded: ReadonlySet<number>
  exits: ReadonlyMap<number, number> | null
  hintCell: number | null
  shakeCell: number | null
  solved: boolean
  /** bumps to replay the solve animation */
  celebrate: number
  onTap(cell: number): void
}

function BoardImpl(props: BoardProps) {
  const { puzzle, route, targets, stranded, exits, hintCell, shakeCell, solved, celebrate, onTap } = props
  const { rows, cols } = puzzle
  const blocked = new Set(puzzle.blocked)
  const wpIndex = new Map(puzzle.waypoints.map((c, i) => [c, i]))
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
      const moves: Record<string, number> = { ArrowUp: -cols, ArrowDown: cols, ArrowLeft: -1, ArrowRight: 1 }
      const d = moves[e.key]
      if (d === undefined) return
      const dr = d === -cols ? -1 : d === cols ? 1 : 0
      const dc = d === -1 ? -1 : d === 1 ? 1 : 0
      let r = Math.floor(cell / cols) + dr
      let c = (cell % cols) + dc
      // Skip blocked squares (they aren't focusable).
      while (r >= 0 && r < rows && c >= 0 && c < cols) {
        const next = buttons.current[r * cols + c]
        if (next) {
          e.preventDefault()
          next.focus()
          return
        }
        r += dr
        c += dc
      }
    },
    [rows, cols],
  )

  const label = (cell: number) => {
    const parts = [squareName(cell, rows, cols)]
    if (blocked.has(cell)) return `${parts[0]}, blocked`
    const w = wpIndex.get(cell)
    if (w !== undefined) parts.push(`number ${w + 1}`)
    const step = stepOf.get(cell)
    if (cell === head) parts.push('knight is here')
    else if (step !== undefined) parts.push(`move ${step + 1}, tap to rewind here`)
    else if (targets.has(cell)) parts.push('can jump here')
    if (stranded.has(cell)) parts.push('cut off')
    return parts.join(', ')
  }

  return (
    <div className="board-frame" data-solved={solved || undefined}>
      <div className="ranks" aria-hidden="true">
        {Array.from({ length: rows }, (_, r) => (
          <span key={r}>{rows - r}</span>
        ))}
      </div>
      <div
        className="board"
        style={{ ['--cols' as string]: cols, ['--rows' as string]: rows, aspectRatio: `${cols} / ${rows}` }}
      >
        <div className="layer squares" aria-hidden="true">
          {cells.map((cell) => {
            const dark = (Math.floor(cell / cols) + (cell % cols)) % 2 === 1
            const cls = ['sq', dark ? 'dark' : 'light']
            if (blocked.has(cell)) cls.push('blocked')
            else if (stepOf.has(cell)) cls.push('visited')
            if (stranded.has(cell)) cls.push('stranded')
            return <div key={cell} className={cls.join(' ')} />
          })}
        </div>

        <svg
          className="layer route"
          viewBox={`0 0 ${cols} ${rows}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          key={`route-${celebrate}`}
        >
          {route.slice(1).map((cell, i) => {
            const [x1, y1] = center(route[i])
            const [x2, y2] = center(cell)
            const age = route.length - 2 - i
            const latest = age === 0
            // Knight routes cross a lot: keep the recent trail bold and let
            // older jumps recede so the player can see where they just went.
            const fade = solved ? 0.85 : age < 3 ? 1 : Math.max(0.3, 1 - (age - 2) * 0.1)
            return (
              <line
                key={`${route[i]}-${cell}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                pathLength={1}
                className={latest && !solved ? 'seg latest' : 'seg'}
                style={
                  solved
                    ? { animationDelay: `${i * 28}ms` }
                    : { opacity: fade, strokeWidth: age < 3 ? 0.085 : 0.06 }
                }
              />
            )
          })}
        </svg>

        <div className="layer pieces" role="group" aria-label="Board" onKeyDown={onKeyDown}>
          {cells.map((cell) => {
            if (blocked.has(cell)) {
              return <div key={cell} className="piece blocked" role="img" aria-label={label(cell)} />
            }
            const w = wpIndex.get(cell)
            const step = stepOf.get(cell)
            const isHead = cell === head
            const cls = ['piece']
            if (targets.has(cell)) cls.push('target')
            if (cell === hintCell) cls.push('hinted')
            if (cell === shakeCell) cls.push('shake')
            if (step !== undefined) cls.push('visited')
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
                {w !== undefined && !isHead && <span className="wp">{w + 1}</span>}
                {isHead && (
                  <span className="knight">
                    <span className="glyph">{KNIGHT}</span>
                    {w !== undefined && <span className="knight-num">{w + 1}</span>}
                  </span>
                )}
                {step !== undefined && !isHead && w === undefined && <span className="step">{step + 1}</span>}
                {exit !== undefined && w === undefined && <span className="exits">{exit}</span>}
                {stranded.has(cell) && <span className="cut" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      </div>
      <div className="files" aria-hidden="true">
        {Array.from({ length: cols }, (_, c) => (
          <span key={c}>{String.fromCharCode(97 + c)}</span>
        ))}
      </div>
    </div>
  )
}

export const Board = memo(BoardImpl)
