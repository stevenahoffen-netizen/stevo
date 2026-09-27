import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doomedCells, exitCounts, legalTargets, nextWaypoint, type MoveError } from '../engine/path'
import {
  dailyFor,
  practicePool,
  practiceTarget,
  today as todayNow,
  tutorialPuzzle,
  TUTORIAL_STEPS,
  type PlayTarget,
  type PracticeSize,
} from '../game/content'
import { EPOCH, WEEKDAY_NAMES, addDays, weekdayIndex } from '../data/schedule'
import { formatTime, msUntilMidnight, plural, shortDate } from '../game/format'
import { haptic, setHapticsEnabled } from '../game/haptics'
import { playError, playJump, playUndo, playWaypoint, playWin, setSoundEnabled } from '../game/sound'
import { applyTheme, loadSettings, saveSettings, type Settings } from '../game/settings'
import {
  decodeChallenge,
  encodeChallenge,
  ghostProgress,
  paceEmoji,
  raceOutcome,
  shareText,
  type Challenge,
} from '../game/share'
import { loadHistory, saveHistory, summarize, type History, type SolveRecord } from '../game/stats'
import { clearAll, load, save, storageKey } from '../game/storage'
import { track } from '../game/analytics'
import { loadSavedSession, useSession, type Session } from '../game/useSession'
import { Board } from './Board'
import { Modal, anyModalOpen } from './Modal'
import { ArchivePanel, HowToPlay, SettingsPanel, StatsPanel, WinPanel, type IntroVariant, type WinInfo } from './Panels'
import { IconBulb, IconCalendar, IconChart, IconGear, IconHelp, IconRestart, IconUndo, KNIGHT } from './icons'

type ShellModal = 'welcome' | 'help' | 'stats' | 'archive' | 'settings'

interface Race {
  challenge: Challenge
  day: string
}

const TIER_PIPS = { easy: 1, medium: 2, hard: 3 } as const

const LESSONS = [
  {
    title: 'Lesson 1 of 3 · Jump',
    text: (k: number) => `Tap a glowing square to jump like a knight. Land on every square once and finish on ${k}.`,
  },
  {
    title: 'Lesson 2 of 3 · In order',
    text: () => 'Pass the numbers in order. Tap an earlier square on your route to rewind to it.',
  },
  {
    title: 'Lesson 3 of 3 · Corners',
    text: () => 'A corner has only two jumps, so the route must use both. The outlined corners are the place to start.',
  },
]

// The hash as the page was opened, read once before anything rewrites it.
const bootHash = typeof window !== 'undefined' ? window.location.hash : ''

type ParsedRace = { race: Race } | { future: number } | null

function parseRace(hash: string, day: string): ParsedRace {
  const ch = decodeChallenge(hash)
  if (!ch || ch.number < 1) return null
  const raceDay = addDays(EPOCH, ch.number - 1)
  if (raceDay > day) return { future: ch.number }
  return { race: { challenge: ch, day: raceDay } }
}

/** Drop a race token from the address bar so a reload or a copied URL doesn't replay it. */
function clearHash() {
  try {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    // sandboxed frames may refuse; the token is harmless if it stays
  }
}

function futureRaceText(n: number): string {
  return `Race #${n} isn’t out yet. It unlocks on ${shortDate(addDays(EPOCH, n - 1))}.`
}

function shareBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_URL as string | undefined
  if (configured) return configured.replace(/#.*$/, '')
  return `${window.location.origin}${window.location.pathname}`
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function inFrame(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/** The local calendar day, kept current across midnight and sleep/wake. */
function useToday(): string {
  const [day, setDay] = useState(todayNow)
  useEffect(() => {
    const refresh = () => setDay(todayNow())
    const id = window.setTimeout(refresh, msUntilMidnight() + 1000)
    const onVis = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', refresh)
    }
  }, [day])
  return day
}

// =============================================================== shell
export function App() {
  const day = useToday()
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [history, setHistory] = useState<History>(loadHistory)
  const [boot] = useState(() => parseRace(bootHash, todayNow()))
  const bootRace = boot && 'race' in boot ? boot.race : null
  const [race, setRace] = useState<Race | null>(bootRace)
  const [target, setTarget] = useState<PlayTarget>(() => dailyFor(bootRace ? bootRace.day : todayNow()))
  // Bumped to remount the board when the same slot is restarted from scratch.
  const [nonce, setNonce] = useState(0)
  const [modal, setModal] = useState<ShellModal | null>(() => (load('seen-intro', false) ? null : 'welcome'))
  const [introVariant, setIntroVariant] = useState<IntroVariant>(bootRace ? 'race' : 'first')
  const [toast, setToast] = useState<string | null>(() => {
    if (boot && 'future' in boot) return futureRaceText(boot.future)
    if (bootRace && load('seen-intro', false)) return `Race on. Your friend finished in ${formatTime(bootRace.challenge.splits[4] * 1000)}.`
    return null
  })

  useEffect(() => {
    applyTheme(settings.theme)
    setSoundEnabled(settings.sound)
    setHapticsEnabled(settings.haptics)
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    clearHash()
    track('app_open', { challenge: !!bootRace })
    if (bootRace) track('challenge_open', { number: bootRace.challenge.number })
  }, [bootRace])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  // Another tab solved something: pick up its history.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === storageKey('history')) setHistory(loadHistory())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const raceRef = useRef(race)
  raceRef.current = race

  const goTo = useCallback((t: PlayTarget) => {
    setTarget(t)
    if (t.fresh) setNonce((n) => n + 1)
    setModal(null)
    // A pending race survives the tutorial, but not a trip to another puzzle.
    if (t.mode !== 'tutorial') setRace((r) => (r && t.mode === 'daily' && t.day === r.day ? r : null))
  }, [])

  const goHome = useCallback(() => {
    const r = raceRef.current
    goTo(dailyFor(r ? r.day : todayNow()))
  }, [goTo])

  // Midnight passed while the page was open: move an untouched daily along.
  const prevDay = useRef(day)
  useEffect(() => {
    const prev = prevDay.current
    prevDay.current = day
    if (prev === day) return
    setTarget((t) => {
      if (t.mode !== 'daily' || t.day !== prev || raceRef.current?.day === t.day) return t
      return loadSavedSession(t.sessionId)?.started ? t : dailyFor(day)
    })
  }, [day])

  // A race link opened in a tab that's already running.
  useEffect(() => {
    const onHash = () => {
      const parsed = parseRace(window.location.hash, todayNow())
      if (!parsed) return
      clearHash()
      if ('future' in parsed) {
        setToast(futureRaceText(parsed.future))
        return
      }
      track('challenge_open', { number: parsed.race.challenge.number })
      setRace(parsed.race)
      setTarget(dailyFor(parsed.race.day))
      setModal((m) => (m === 'welcome' ? m : null))
      setToast(`Race on. Your friend finished in ${formatTime(parsed.race.challenge.splits[4] * 1000)}.`)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const nextPractice = useCallback(
    (size: PracticeSize, currentId?: string) => {
      const pool = practicePool(size)
      const solved = loadHistory().practice
      const others = pool.filter((p) => p.id !== currentId)
      const pick = others.find((p) => !solved[p.id]) ?? others[Math.floor(Math.random() * others.length)] ?? pool[0]
      // Everything solved: replay one from scratch rather than showing a finished board.
      goTo(practiceTarget(pick, !!solved[pick.id]))
    },
    [goTo],
  )

  const startTutorial = useCallback(() => {
    save('seen-intro', true)
    goTo(tutorialPuzzle(0))
  }, [goTo])

  const closeModal = () => {
    if (modal === 'welcome') save('seen-intro', true)
    setModal(null)
  }

  const onSolved = useCallback((t: PlayTarget, record: SolveRecord, startedDay: string | undefined) => {
    if (t.mode === 'tutorial') {
      if (t.step === TUTORIAL_STEPS - 1) {
        save('tutorial-done', true)
        track('tutorial_complete')
      }
      return
    }
    // Merge into what's stored now, in case another tab wrote since we loaded.
    const h = loadHistory()
    if (t.mode === 'daily' && t.day && !h.dailies[t.day]) {
      h.dailies[t.day] = { ...record, onTime: t.day === todayNow() || startedDay === t.day }
    }
    if (t.mode === 'practice' && !h.practice[t.puzzle.id]) h.practice[t.puzzle.id] = record
    saveHistory(h)
    setHistory(h)
  }, [])

  const challenge = race && target.mode === 'daily' && target.day === race.day ? race.challenge : null

  return (
    <div className="app">
      <header className="top">
        <h1 className="wordmark">
          <span className="wordmark-knight" aria-hidden="true">
            {KNIGHT}
          </span>
          Knightline
        </h1>
        <nav className="top-actions" aria-label="Menu">
          <button
            type="button"
            className="icon-btn"
            aria-label="How to play"
            onClick={() => {
              setIntroVariant('help')
              setModal('help')
            }}
          >
            <IconHelp />
          </button>
          <button type="button" className="icon-btn" aria-label="Archive and practice" onClick={() => setModal('archive')}>
            <IconCalendar />
          </button>
          <button type="button" className="icon-btn" aria-label="Statistics" onClick={() => setModal('stats')}>
            <IconChart />
          </button>
          <button type="button" className="icon-btn" aria-label="Settings" onClick={() => setModal('settings')}>
            <IconGear />
          </button>
        </nav>
      </header>

      <PlayView
        key={`${target.sessionId}#${nonce}`}
        target={target}
        today={day}
        paused={modal !== null}
        settings={settings}
        history={history}
        challenge={challenge}
        onSolved={onSolved}
        goTo={goTo}
        goHome={goHome}
        nextPractice={nextPractice}
        openArchive={() => setModal('archive')}
        setToast={setToast}
      />

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {(modal === 'welcome' || modal === 'help') && (
        <Modal title={introVariant === 'race' ? 'You’ve been challenged' : 'How to play'} onClose={closeModal}>
          <HowToPlay
            variant={modal === 'help' ? 'help' : introVariant}
            onPlay={() => {
              closeModal()
              if (target.mode === 'tutorial') goHome()
            }}
            onTutorial={startTutorial}
          />
        </Modal>
      )}
      {modal === 'stats' && (
        <Modal title="Statistics" onClose={closeModal}>
          <StatsPanel history={history} today={day} />
        </Modal>
      )}
      {modal === 'archive' && (
        <Modal title="Archive" onClose={closeModal} wide>
          <ArchivePanel
            history={history}
            today={day}
            onPickDay={(d) => goTo(dailyFor(d))}
            onPractice={(s) => nextPractice(s, target.mode === 'practice' ? target.puzzle.id : undefined)}
          />
        </Modal>
      )}
      {modal === 'settings' && (
        <Modal title="Settings" onClose={closeModal}>
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onReset={() => {
              clearAll()
              window.location.reload()
            }}
          />
        </Modal>
      )}
    </div>
  )
}

// =============================================================== one puzzle
interface PlayViewProps {
  target: PlayTarget
  /** the current local day */
  today: string
  /** a shell dialog is open: stop the clock */
  paused: boolean
  settings: Settings
  history: History
  challenge: Challenge | null
  onSolved(t: PlayTarget, record: SolveRecord, startedDay: string | undefined): void
  goTo(t: PlayTarget): void
  goHome(): void
  nextPractice(size: PracticeSize, currentId?: string): void
  openArchive(): void
  setToast(text: string | null): void
}

type NoteAction = { kind: 'undo' } | { kind: 'rewind'; index: number }

/** A status message tied to one route: it disappears as soon as the route changes. */
interface Note {
  text: string
  tone: 'info' | 'error'
  action?: NoteAction
  hintCell?: number
  len: number
  head: number
}

function PlayView(props: PlayViewProps) {
  const { target, today, paused, settings, history, challenge, onSolved, goTo, goHome, nextPractice, openArchive, setToast } =
    props
  const session = useSession(target.puzzle, target.sessionId, paused, target.fresh)
  const { game, data } = session
  const { puzzle } = target

  const [note, setNote] = useState<Note | null>(null)
  const [shake, setShake] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(0)
  const [winOpen, setWinOpen] = useState(false)
  const [copyFallback, setCopyFallback] = useState<string | null>(null)

  const route = data.route
  const head = route[route.length - 1]
  const active = note && note.len === route.length && note.head === head ? note : null

  useEffect(() => {
    track('puzzle_start', { mode: target.mode, id: puzzle.id, size: puzzle.rows })
  }, [target.mode, puzzle.id, puzzle.rows])

  useEffect(() => {
    if (shake === null) return
    const id = window.setTimeout(() => setShake(null), 400)
    return () => window.clearTimeout(id)
  }, [shake])

  // Error messages fade on their own; hints and rewinds stay until the next move.
  useEffect(() => {
    if (!note || note.tone !== 'error') return
    const id = window.setTimeout(() => setNote((n) => (n === note ? null : n)), 4000)
    return () => window.clearTimeout(id)
  }, [note])

  // Solved during this visit (not restored as already solved): record + celebrate.
  const alreadySolved = useRef(data.solved)
  useEffect(() => {
    if (!data.solved || alreadySolved.current) return
    alreadySolved.current = true
    onSolved(target, { ms: data.elapsedMs, hints: data.hints, backtracks: data.backtracks, size: puzzle.rows }, data.startedDay)
    track('puzzle_complete', {
      mode: target.mode,
      id: puzzle.id,
      size: puzzle.rows,
      ms: Math.round(data.elapsedMs),
      hints: data.hints,
      backtracks: data.backtracks,
    })
    playWin()
    haptic.win()
    setCelebrate((c) => c + 1)
  }, [data.solved, data.elapsedMs, data.hints, data.backtracks, data.startedDay, puzzle.id, puzzle.rows, target, onSolved])

  useEffect(() => {
    if (!celebrate) return
    const id = window.setTimeout(() => setWinOpen(true), 1100)
    return () => window.clearTimeout(id)
  }, [celebrate])

  // Opened a race on a puzzle you've already solved: go straight to the verdict.
  useEffect(() => {
    if (challenge && alreadySolved.current) setWinOpen(true)
  }, [challenge])

  // ---- derived board state
  const targets = useMemo(() => new Set(data.solved ? [] : legalTargets(game, route)), [game, route, data.solved])
  const doomed = useMemo(() => new Set(data.solved ? [] : doomedCells(game, route)), [game, route, data.solved])
  const exits = useMemo(
    () => (settings.showExits && !data.solved ? exitCounts(game, route) : null),
    [settings.showExits, game, route, data.solved],
  )
  const emphasize = useMemo(() => {
    if (target.mode !== 'tutorial' || target.step !== 2) return undefined
    const { rows, cols } = puzzle
    const blocked = new Set(puzzle.blocked)
    return new Set([0, cols - 1, (rows - 1) * cols, rows * cols - 1].filter((c) => !blocked.has(c)))
  }, [target.mode, target.step, puzzle])
  const nextNum = nextWaypoint(game, route) + 1
  const finishNum = puzzle.waypoints.length

  const errorText = (err: MoveError): string | null => {
    switch (err) {
      case 'not-knight':
        return 'Knights jump in an L: two squares one way, one to the side.'
      case 'order':
        return nextNum === finishNum
          ? `Cover every other square before finishing on ${finishNum}.`
          : `Reach ${nextNum} first. Numbers go in order.`
      case 'finish-last':
        return `${finishNum} is the finish. Cover every other square first.`
      default:
        return null
    }
  }

  const onTap = (cell: number) => {
    if (data.solved) return
    const idx = route.indexOf(cell)
    if (idx >= 0) {
      if (idx < route.length - 1) {
        const n = route.length - 1 - idx
        session.rewindTo(idx)
        setNote({ text: `Rewound ${plural(n, 'move')}.`, tone: 'info', action: { kind: 'undo' }, len: idx + 1, head: cell })
        playUndo()
        track('backtrack', { kind: 'rewind' })
      }
      return
    }
    const err = session.jump(cell)
    if (err) {
      const text = errorText(err)
      if (text) {
        setNote({ text, tone: 'error', len: route.length, head })
        setShake(cell)
        playError()
        haptic.error()
      }
      return
    }
    if (!data.started) track('first_move', { id: puzzle.id })
    if (game.waypointIndex.has(cell)) {
      playWaypoint()
      haptic.waypoint()
    } else {
      playJump(route.length / game.total)
      haptic.jump()
    }
  }

  const canUndo = !data.solved && (route.length > 1 || (data.undoRoute?.length ?? 0) > route.length)

  const onUndo = () => {
    const r = session.undo()
    if (!r) return
    setNote(null)
    playUndo()
    track('backtrack', { kind: r === 'restored' ? 'restore' : 'undo' })
  }

  const onRestart = () => {
    if (route.length <= 1 || data.solved) return
    session.restart()
    setNote({ text: 'Back to the start.', tone: 'info', action: { kind: 'undo' }, len: 1, head: route[0] })
    playUndo()
    track('backtrack', { kind: 'restart' })
  }

  const onHint = () => {
    if (data.solved) return
    const h = session.hint()
    track('hint', { id: puzzle.id, kind: h.kind })
    if (h.kind === 'next') {
      setNote({ text: 'Try the highlighted square.', tone: 'info', hintCell: h.cell, len: route.length, head })
    } else if (h.kind === 'rewind') {
      setNote({
        text: h.index === 0 ? 'Your first jump went off course.' : 'Your route went wrong after the highlighted square.',
        tone: 'info',
        hintCell: h.cell,
        action: { kind: 'rewind', index: h.index },
        len: route.length,
        head,
      })
    }
  }

  // Keyboard: U or Backspace undoes, H asks for a hint.
  const keys = useRef({ onUndo, onHint })
  keys.current = { onUndo, onHint }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || anyModalOpen()) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'u' || k === 'backspace') {
        e.preventDefault()
        keys.current.onUndo()
      } else if (k === 'h') {
        e.preventDefault()
        keys.current.onHint()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ---- labels and sharing
  const isToday = target.mode === 'daily' && target.day === today
  const dayName = target.day ? WEEKDAY_NAMES[weekdayIndex(target.day)] : ''
  const sizeLabel = `${puzzle.rows}×${puzzle.cols}`
  const shareLabel =
    target.mode === 'daily'
      ? `Knightline #${target.number} ${KNIGHT} ${dayName.slice(0, 3)} ${sizeLabel}`
      : `Knightline practice ${KNIGHT} ${sizeLabel}`
  const splitsMs = data.splits.map((s) => s ?? data.elapsedMs)
  const raceToken = target.mode === 'daily' && target.number ? encodeChallenge(target.number, splitsMs) : null
  const raceUrl = raceToken ? `${shareBaseUrl()}#${raceToken}` : undefined

  const share = async (text: string, kind: 'result' | 'race') => {
    track('share', { kind, mode: target.mode })
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    if (kind === 'result' && typeof nav.share === 'function' && coarse && !inFrame()) {
      try {
        await nav.share({ text })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
        // otherwise fall through to copying
      }
    }
    if (await copyText(text)) {
      setToast(kind === 'race' ? 'Race link copied. Send it to a friend.' : 'Result copied. Paste it anywhere.')
      setCopyFallback(null)
    } else {
      setCopyFallback(text)
    }
  }

  const record = target.mode === 'daily' && target.day ? history.dailies[target.day] : undefined
  const streak = useMemo(() => summarize(history, today).streak.current, [history, today])

  const raceText = (() => {
    if (!challenge) return undefined
    const theirs = formatTime(challenge.splits[4] * 1000)
    const o = raceOutcome(challenge, data.elapsedMs)
    if (o.kind === 'tie') return `Dead heat: you both finished in ${theirs}.`
    const diff = formatTime(o.diffSec * 1000)
    return o.kind === 'won' ? `You beat your friend’s ${theirs} by ${diff}.` : `Your friend’s ${theirs} holds, by ${diff}.`
  })()

  const winInfo: WinInfo = {
    heading: target.mode === 'tutorial' ? 'Nicely done' : target.mode === 'daily' ? `No. ${target.number} solved` : 'Solved',
    ms: data.elapsedMs,
    hints: data.hints,
    backtracks: data.backtracks,
    pace: paceEmoji(splitsMs),
    streak: record?.onTime ? streak : undefined,
    challengeResult: raceText,
    shareText:
      target.mode === 'tutorial'
        ? undefined
        : shareText({ label: shareLabel, ms: data.elapsedMs, hints: data.hints, backtracks: data.backtracks, splitsMs, url: raceUrl }),
    isDaily: target.mode === 'daily',
    isTutorial: target.mode === 'tutorial',
    hasNextTutorial: target.mode === 'tutorial' && (target.step ?? 0) < TUTORIAL_STEPS - 1,
    isPractice: target.mode === 'practice',
    newDailyOut: target.mode === 'daily' && target.day !== today && !history.dailies[today],
  }

  // ---- status line
  let status: string
  let tone: 'info' | 'error' | 'warn' = 'info'
  if (data.solved) status = `Solved in ${formatTime(data.elapsedMs)}.`
  else if (active) {
    status = active.text
    tone = active.tone
  } else if (doomed.size) {
    status = 'A square is a dead end. Rewind to free it.'
    tone = 'warn'
  } else if (targets.size === 0) {
    status = 'No jumps left. Undo, or tap an earlier square to rewind.'
    tone = 'warn'
  } else if (route.length === 1) status = 'Start on 1. Tap a glowing square to jump.'
  else if (nextNum === finishNum) status = `Cover the rest, then finish on ${finishNum}.`
  else status = `Next number: ${nextNum}`

  const action = !data.solved ? active?.action : undefined

  return (
    <main className="play">
      <section className="meta" aria-label="Puzzle">
        <div className="meta-left">
          <p className="meta-title">
            {target.mode === 'daily' && (
              <>
                No. {target.number}{' '}
                <span className="meta-day">
                  {isToday ? dayName : `${dayName.slice(0, 3)} ${shortDate(target.day!)}`}
                </span>
              </>
            )}
            {target.mode === 'practice' && 'Practice'}
            {target.mode === 'tutorial' && 'Tutorial'}
          </p>
          <p className="meta-sub">
            <span>{sizeLabel}</span>
            {puzzle.tier && target.mode !== 'tutorial' && (
              <span className="pips" role="img" aria-label={`Difficulty: ${puzzle.tier}`}>
                {[1, 2, 3].map((i) => (
                  <span key={i} className={i <= TIER_PIPS[puzzle.tier!] ? 'pip on' : 'pip'}>
                    {KNIGHT}
                  </span>
                ))}
              </span>
            )}
          </p>
        </div>
        <div className="meta-right">
          <p className="clock" aria-label="Time" data-testid="clock">
            <Clock session={session} />
          </p>
          <p className="moves" data-testid="moves">
            {route.length}/{game.total} squares
          </p>
        </div>
      </section>

      {target.mode === 'tutorial' && target.step !== undefined && (
        <aside className="coach">
          <p className="coach-title">{LESSONS[target.step].title}</p>
          <p>{LESSONS[target.step].text(finishNum)}</p>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              save('tutorial-done', true)
              goHome()
            }}
          >
            Skip tutorial
          </button>
        </aside>
      )}

      {challenge && !data.solved && <GhostBar challenge={challenge} session={session} />}

      <div className="board-slot">
        <Board
          puzzle={puzzle}
          route={route}
          targets={targets}
          doomed={doomed}
          exits={exits}
          hintCell={active?.hintCell ?? null}
          shakeCell={shake}
          solved={data.solved}
          showSteps={settings.showSteps}
          emphasize={emphasize}
          celebrate={celebrate}
          onTap={onTap}
        />
      </div>

      <div className="status" role="status" aria-live="polite" data-testid="status" data-tone={tone}>
        <span>{status}</span>
        {action?.kind === 'undo' && (
          <button type="button" className="link-btn" onClick={onUndo}>
            Undo
          </button>
        )}
        {action?.kind === 'rewind' && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              const n = route.length - 1 - action.index
              session.rewindTo(action.index)
              setNote({
                text: `Rewound ${plural(n, 'move')}.`,
                tone: 'info',
                action: { kind: 'undo' },
                len: action.index + 1,
                head: route[action.index],
              })
              playUndo()
              track('backtrack', { kind: 'hint-rewind' })
            }}
          >
            {action.index === 0 ? 'Rewind to the start' : 'Rewind there'}
          </button>
        )}
        {data.solved && !winOpen && (
          <button type="button" className="link-btn" onClick={() => setWinOpen(true)}>
            See result
          </button>
        )}
      </div>

      <div className="controls">
        <button type="button" className="btn" onClick={onUndo} disabled={!canUndo} aria-keyshortcuts="U">
          <IconUndo size={18} /> Undo
        </button>
        <button type="button" className="btn" onClick={onRestart} disabled={route.length <= 1 || data.solved}>
          <IconRestart size={18} /> Restart
        </button>
        <button type="button" className="btn hint" onClick={onHint} disabled={data.solved} aria-keyshortcuts="H">
          <IconBulb size={18} /> Hint
        </button>
      </div>

      {!isToday && target.mode !== 'tutorial' && (
        <button type="button" className="link-btn back-today" onClick={() => goTo(dailyFor(today))}>
          Back to today’s puzzle
        </button>
      )}

      {winOpen && (
        <Modal title={winInfo.heading} onClose={() => setWinOpen(false)}>
          <WinPanel
            info={winInfo}
            onShare={() => winInfo.shareText && share(winInfo.shareText, 'result')}
            onChallenge={() => raceUrl && share(raceUrl, 'race')}
            onNext={() => {
              if (target.mode === 'tutorial') {
                const next = (target.step ?? 0) + 1
                if (next < TUTORIAL_STEPS) goTo(tutorialPuzzle(next))
                else goHome()
              } else if (target.mode === 'practice') {
                nextPractice(String(puzzle.rows) as PracticeSize, puzzle.id)
              }
            }}
            onArchive={() => {
              setWinOpen(false)
              openArchive()
            }}
            onToday={() => goTo(dailyFor(today))}
          />
          {copyFallback && (
            <div className="copy-fallback">
              <p className="fine">Your browser blocked copying. Select the text below and copy it.</p>
              <textarea
                id="copy-fallback"
                readOnly
                value={copyFallback}
                rows={5}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          )}
        </Modal>
      )}
    </main>
  )
}

/** The clock re-renders on its own so the board doesn't. */
function Clock({ session }: { session: Session }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 500)
    return () => window.clearInterval(id)
  }, [])
  return <>{formatTime(session.elapsedNow())}</>
}

function GhostBar({ challenge, session }: { challenge: Challenge; session: Session }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 250)
    return () => window.clearInterval(id)
  }, [])
  const mine = session.data.route.length / session.game.total
  const theirs = session.data.started ? ghostProgress(challenge, session.elapsedNow()) : 0
  return (
    <div className="ghost" role="group" aria-label="Race against your friend" data-testid="ghost">
      <div className="ghost-row">
        <span>You</span>
        <div className="ghost-track">
          <div className="ghost-fill you" style={{ width: `${mine * 100}%` }} />
        </div>
        <span className="ghost-time" />
      </div>
      <div className="ghost-row">
        <span>Friend</span>
        <div className="ghost-track">
          <div className="ghost-fill them" style={{ width: `${theirs * 100}%` }} />
        </div>
        <span className="ghost-time">{formatTime(challenge.splits[4] * 1000)}</span>
      </div>
    </div>
  )
}
