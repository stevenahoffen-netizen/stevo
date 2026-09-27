// One play session on one puzzle: the route, the timer, hints, backtracks and
// split times. Progress is saved per play slot (a daily's calendar day, or a
// practice/tutorial puzzle id) and restored on reload.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { checkMove, isSolved, makeGame, divergenceIndex, type Game, type MoveError } from '../engine/path'
import type { Puzzle } from '../engine/puzzle'
import { formatDay } from '../data/schedule'
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
  /** local calendar day of the first jump */
  startedDay?: string
  /** the route before the last rewind/restart, so Undo can bring it back */
  undoRoute?: number[]
}

export type HintResult =
  | { kind: 'next'; cell: number }
  | { kind: 'rewind'; index: number; cell: number }
  | { kind: 'solved' }

const key = (sessionId: string) => `session:${sessionId}`

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

function restore(p: Puzzle, game: Game, sessionId: string): SessionData {
  const saved = load<SessionData | null>(key(sessionId), null)
  if (!saved || !Array.isArray(saved.route) || saved.route[0] !== p.waypoints[0]) return fresh(p)
  // Re-validate the saved route step by step; drop anything that no longer fits.
  const route = [saved.route[0]]
  for (const cell of saved.route.slice(1)) {
    if (checkMove(game, route, cell) !== null) break
    route.push(cell)
  }
  return { ...fresh(p), ...saved, route, solved: isSolved(game, route), undoRoute: undefined }
}

export function loadSavedSession(sessionId: string): SessionData | null {
  return load<SessionData | null>(key(sessionId), null)
}

export interface Session {
  game: Game
  data: SessionData
  jump(cell: number): MoveError | null
  rewindTo(index: number): void
  /** undo one jump, or bring back the route from before a rewind */
  undo(): 'restored' | 'stepped' | null
  restart(): void
  hint(): HintResult
  elapsedNow(): number
}

/**
 * Mount one per play slot (key the component by session id): the session is
 * initialised from saved progress on mount (or from scratch with
 * `startFresh`, which then overwrites the save) and never switches puzzles.
 */
export function useSession(puzzle: Puzzle, sessionId: string, paused = false, startFresh = false): Session {
  const game = useMemo(() => makeGame(puzzle), [puzzle])
  const [data, setData] = useState<SessionData>(() => (startFresh ? fresh(puzzle) : restore(puzzle, game, sessionId)))
  // dataRef is always the latest state, including updates React hasn't rendered yet.
  const dataRef = useRef(data)
  const lastTick = useRef<number | null>(null)

  const commit = useCallback((next: SessionData) => {
    dataRef.current = next
    setData(next)
  }, [])

  const elapsedNow = useCallback(() => {
    const d = dataRef.current
    if (d.started && !d.solved && lastTick.current !== null && !document.hidden) {
      return d.elapsedMs + (performance.now() - lastTick.current)
    }
    return d.elapsedMs
  }, [])

  /** Folds time since the last tick into the state and restarts the tick clock. */
  const settle = useCallback((): SessionData => {
    const d = dataRef.current
    const t = elapsedNow()
    lastTick.current = d.started && !d.solved && !document.hidden ? performance.now() : null
    return t === d.elapsedMs ? d : { ...d, elapsedMs: t }
  }, [elapsedNow])

  // Timer: runs after the first jump; pauses while the tab is hidden or a
  // dialog is open.
  const running = data.started && !data.solved && !paused
  useEffect(() => {
    if (!running) {
      lastTick.current = null
      return
    }
    lastTick.current = document.hidden ? null : performance.now()
    const tick = () => {
      if (document.hidden) {
        lastTick.current = null
        return
      }
      if (lastTick.current === null) {
        lastTick.current = performance.now()
        return
      }
      commit(settle())
    }
    const id = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      // Keep the time played up to this moment.
      if (lastTick.current !== null && !document.hidden) {
        const d = dataRef.current
        if (!d.solved) commit({ ...d, elapsedMs: d.elapsedMs + (performance.now() - lastTick.current) })
      }
      lastTick.current = null
    }
  }, [running, commit, settle])

  // Persist: immediately when the route or counters change, otherwise every
  // ~2s, and always when the page is hidden or closed.
  const lastSave = useRef({ at: 0, sig: '' })
  useEffect(() => {
    const sig = `${data.route.length}|${data.route[data.route.length - 1]}|${data.hints}|${data.backtracks}|${data.solved}`
    const now = Date.now()
    if (sig !== lastSave.current.sig || now - lastSave.current.at > 2000) {
      save(key(sessionId), data)
      lastSave.current = { at: now, sig }
    }
  }, [data, sessionId])

  useEffect(() => {
    const flush = () => save(key(sessionId), { ...dataRef.current, elapsedMs: elapsedNow() })
    const onVis = () => {
      if (document.hidden) flush()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [sessionId, elapsedNow])

  const jump = useCallback(
    (cell: number): MoveError | null => {
      const d = settle()
      if (d.solved) return null
      const err = checkMove(game, d.route, cell)
      if (err) return err
      const route = [...d.route, cell]
      const t = d.elapsedMs
      const splits = [...d.splits]
      splitThresholds(game.total).forEach((threshold, k) => {
        if (route.length === threshold) splits[k] = t
      })
      const solved = isSolved(game, route)
      if (solved) {
        splits[4] = t
        lastTick.current = null
      }
      commit({
        ...d,
        route,
        splits,
        solved,
        started: true,
        startedDay: d.startedDay ?? formatDay(new Date()),
        undoRoute: undefined,
      })
      return null
    },
    [game, settle, commit],
  )

  const backtrackTo = useCallback(
    (route: number[]) => {
      const d = settle()
      if (d.solved || route.length === d.route.length) return
      commit({ ...d, route, backtracks: d.backtracks + 1, undoRoute: d.route })
    },
    [settle, commit],
  )

  const rewindTo = useCallback((index: number) => backtrackTo(dataRef.current.route.slice(0, index + 1)), [backtrackTo])
  const restart = useCallback(() => {
    const r = dataRef.current.route
    if (r.length > 1) backtrackTo(r.slice(0, 1))
  }, [backtrackTo])

  const undo = useCallback((): 'restored' | 'stepped' | null => {
    const d = settle()
    if (d.solved) return null
    if (d.undoRoute && d.undoRoute.length > d.route.length) {
      // Bring back the route from before a rewind (no new jumps were made since).
      commit({ ...d, route: d.undoRoute, undoRoute: undefined })
      return 'restored'
    }
    if (d.route.length <= 1) return null
    commit({ ...d, route: d.route.slice(0, -1), backtracks: d.backtracks + 1, undoRoute: undefined })
    return 'stepped'
  }, [settle, commit])

  const hint = useCallback((): HintResult => {
    const d = settle()
    if (d.solved) return { kind: 'solved' }
    const div = divergenceIndex(game, d.route)
    commit({ ...d, hints: d.hints + 1 })
    if (div >= 1) return { kind: 'rewind', index: div - 1, cell: d.route[div - 1] }
    return { kind: 'next', cell: puzzle.solution[d.route.length] }
  }, [game, puzzle, settle, commit])

  return { game, data, jump, rewindTo, undo, restart, hint, elapsedNow }
}
