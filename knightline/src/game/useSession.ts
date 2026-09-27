// One play session on one puzzle: the route, the timer, hints, backtracks and
// split times. Progress is saved per puzzle and restored on reload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { checkMove, isSolved, makeGame, divergenceIndex, type Game, type MoveError } from '../engine/path'
import type { Puzzle } from '../engine/puzzle'
import { splitThresholds } from './share'
import { load, save } from './storage'

export interface SessionData {
  route: number[]
  elapsedMs: number
  hints: number
  backtracks: number
  /** elapsed ms when the route last reached each fifth */
  splits: Array<number | null>
  started: boolean
  solved: boolean
}

export type HintResult =
  | { kind: 'next'; cell: number }
  | { kind: 'rewind'; index: number; cell: number }
  | { kind: 'solved' }

const key = (p: Puzzle) => `session:${p.id}`

function fresh(p: Puzzle): SessionData {
  return {
    route: [p.waypoints[0]],
    elapsedMs: 0,
    hints: 0,
    backtracks: 0,
    splits: [null, null, null, null, null],
    started: false,
    solved: false,
  }
}

function restore(p: Puzzle, game: Game): SessionData {
  const saved = load<SessionData | null>(key(p), null)
  if (!saved || !Array.isArray(saved.route) || saved.route[0] !== p.waypoints[0]) return fresh(p)
  // Re-validate the saved route step by step; drop anything that no longer fits.
  const route = [saved.route[0]]
  for (const cell of saved.route.slice(1)) {
    if (checkMove(game, route, cell) !== null) break
    route.push(cell)
  }
  return { ...fresh(p), ...saved, route, solved: isSolved(game, route) }
}

export function loadSavedSession(p: Puzzle): SessionData | null {
  return load<SessionData | null>(key(p), null)
}

export interface Session {
  game: Game
  data: SessionData
  jump(cell: number): MoveError | null
  rewindTo(index: number): void
  undo(): void
  restart(): void
  hint(): HintResult
  elapsedNow(): number
}

/**
 * Mount one per puzzle (key the component by puzzle id): the session is
 * initialised from saved progress on mount and never switches puzzles.
 */
export function useSession(puzzle: Puzzle): Session {
  const game = useMemo(() => makeGame(puzzle), [puzzle])
  const [data, setData] = useState<SessionData>(() => restore(puzzle, game))
  const dataRef = useRef(data)
  dataRef.current = data
  const lastTick = useRef<number | null>(null)

  // Timer: runs after the first jump, pauses while the tab is hidden.
  const running = data.started && !data.solved
  useEffect(() => {
    if (!running) {
      lastTick.current = null
      return
    }
    const tick = () => {
      if (document.hidden) {
        lastTick.current = null
        return
      }
      const now = performance.now()
      if (lastTick.current !== null) {
        const dt = now - lastTick.current
        setData((d) => (d.solved ? d : { ...d, elapsedMs: d.elapsedMs + dt }))
      }
      lastTick.current = now
    }
    tick()
    const id = window.setInterval(tick, 250)
    const onVis = () => tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
      lastTick.current = null
    }
  }, [running, puzzle.id])

  // Persist: immediately when the route or counters change, otherwise every ~2s.
  const lastSave = useRef({ at: 0, sig: '' })
  useEffect(() => {
    const sig = `${data.route.length}|${data.route[data.route.length - 1]}|${data.hints}|${data.backtracks}|${data.solved}`
    const now = Date.now()
    if (sig !== lastSave.current.sig || now - lastSave.current.at > 2000) {
      save(key(puzzle), data)
      lastSave.current = { at: now, sig }
    }
  }, [data, puzzle])

  const elapsedNow = useCallback(() => {
    const d = dataRef.current
    if (d.started && !d.solved && lastTick.current !== null && !document.hidden) {
      return d.elapsedMs + (performance.now() - lastTick.current)
    }
    return d.elapsedMs
  }, [])

  const jump = useCallback(
    (cell: number): MoveError | null => {
      const d = dataRef.current
      if (d.solved) return null
      const err = checkMove(game, d.route, cell)
      if (err) return err
      const route = [...d.route, cell]
      const t = elapsedNow()
      const splits = [...d.splits]
      splitThresholds(game.total).forEach((threshold, k) => {
        if (route.length === threshold) splits[k] = t
      })
      const solved = isSolved(game, route)
      const next: SessionData = { ...d, route, splits, started: true, solved, elapsedMs: t }
      if (solved) {
        splits[4] = t
        lastTick.current = null
      } else {
        lastTick.current = d.started ? performance.now() : null
      }
      dataRef.current = next
      setData(next)
      return null
    },
    [game, elapsedNow],
  )

  const setRoute = useCallback(
    (route: number[]) => {
      const d = dataRef.current
      if (d.solved || route.length === d.route.length) return
      const next = { ...d, route, backtracks: d.backtracks + 1, elapsedMs: elapsedNow() }
      if (d.started) lastTick.current = performance.now()
      dataRef.current = next
      setData(next)
    },
    [elapsedNow],
  )

  const rewindTo = useCallback((index: number) => setRoute(dataRef.current.route.slice(0, index + 1)), [setRoute])
  const undo = useCallback(() => {
    const r = dataRef.current.route
    if (r.length > 1) setRoute(r.slice(0, -1))
  }, [setRoute])
  const restart = useCallback(() => {
    const r = dataRef.current.route
    if (r.length > 1) setRoute(r.slice(0, 1))
  }, [setRoute])

  const hint = useCallback((): HintResult => {
    const d = dataRef.current
    if (d.solved) return { kind: 'solved' }
    const div = divergenceIndex(game, d.route)
    const next = { ...d, hints: d.hints + 1, elapsedMs: elapsedNow() }
    if (d.started) lastTick.current = performance.now()
    dataRef.current = next
    setData(next)
    if (div >= 1) return { kind: 'rewind', index: div - 1, cell: d.route[div - 1] }
    return { kind: 'next', cell: puzzle.solution[d.route.length] }
  }, [game, puzzle, elapsedNow])

  return { game, data, jump, rewindTo, undo, restart, hint, elapsedNow }
}
