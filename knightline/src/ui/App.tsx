import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { exitCounts, legalTargets, nextWaypoint, strandedCells, type MoveError } from '../engine/path'
import {
  dailyFor,
  practicePool,
  today,
  tutorialPuzzle,
  TUTORIAL_STEPS,
  type PlayTarget,
  type PracticeSize,
} from '../game/content'
import { EPOCH, WEEKDAY_NAMES, addDays, weekdayIndex } from '../data/schedule'
import { formatTime } from '../game/format'
import { haptic, setHapticsEnabled } from '../game/haptics'
import { playError, playJump, playUndo, playWaypoint, playWin, setSoundEnabled } from '../game/sound'
import { applyTheme, loadSettings, saveSettings, type Settings } from '../game/settings'
import { decodeChallenge, encodeChallenge, ghostProgress, paceEmoji, shareText, type Challenge } from '../game/share'
import { loadHistory, saveHistory, summarize, type History } from '../game/stats'
import { clearAll, load, save } from '../game/storage'
import { track } from '../game/analytics'
import { useSession, type Session } from '../game/useSession'
import { Board } from './Board'
import { Modal } from './Modal'
import { ArchivePanel, HowToPlay, SettingsPanel, StatsPanel, WinPanel, type WinInfo } from './Panels'
import { IconBulb, IconCalendar, IconChart, IconGear, IconHelp, IconRestart, IconUndo, KNIGHT } from './icons'

type ShellModal = 'welcome' | 'help' | 'stats' | 'archive' | 'settings'

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
    text: () => 'A corner has only two jumps, so the route must use both. When you’re stuck, look at the corners.',
  },
]

function initialChallenge(): { challenge: Challenge; day: string } | null {
  try {
    const ch = decodeChallenge(window.location.hash)
    if (!ch) return null
    const day = addDays(EPOCH, ch.number - 1)
    if (day < EPOCH || day > today()) return null
    return { challenge: ch, day }
  } catch {
    return null
  }
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

// =============================================================== shell
export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [history, setHistory] = useState<History>(loadHistory)
  const startChallenge = useMemo(initialChallenge, [])
  const [challenge, setChallenge] = useState<Challenge | null>(startChallenge?.challenge ?? null)
  const [target, setTarget] = useState<PlayTarget>(() =>
    startChallenge ? dailyFor(startChallenge.day) : dailyFor(today()),
  )
  const [modal, setModal] = useState<ShellModal | null>(() =>
    !startChallenge && !load('seen-intro', false) ? 'welcome' : null,
  )
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    applyTheme(settings.theme)
    setSoundEnabled(settings.sound)
    setHapticsEnabled(settings.haptics)
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    track('app_open', { challenge: !!startChallenge })
    if (startChallenge) track('challenge_open', { number: startChallenge.challenge.number })
  }, [startChallenge])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  const goTo = useCallback(
    (t: PlayTarget) => {
      setTarget(t)
      setModal(null)
      if (t.mode !== 'daily' || t.day !== startChallenge?.day) setChallenge(null)
    },
    [startChallenge],
  )

  const nextPractice = useCallback(
    (size: PracticeSize, currentId?: string) => {
      const pool = practicePool(size)
      const pick =
        pool.find((p) => !history.practice[p.id] && p.id !== currentId) ??
        pool[Math.floor(Math.random() * pool.length)]
      goTo({ mode: 'practice', puzzle: pick })
    },
    [history, goTo],
  )

  const closeModal = () => {
    if (modal === 'welcome') save('seen-intro', true)
    setModal(null)
  }

  const onSolved = useCallback(
    (t: PlayTarget, record: { ms: number; hints: number; backtracks: number; size: number }) => {
      setHistory((h) => {
        const next: History = { dailies: { ...h.dailies }, practice: { ...h.practice } }
        if (t.mode === 'daily' && t.day && !next.dailies[t.day]) {
          next.dailies[t.day] = { ...record, onTime: t.day === today() }
        }
        if (t.mode === 'practice' && !next.practice[t.puzzle.id]) next.practice[t.puzzle.id] = record
        saveHistory(next)
        return next
      })
      if (t.mode === 'tutorial' && t.step === TUTORIAL_STEPS - 1) {
        save('tutorial-done', true)
        track('tutorial_complete')
      }
    },
    [],
  )

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
          <button type="button" className="icon-btn" aria-label="How to play" onClick={() => setModal('help')}>
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
        key={target.puzzle.id}
        target={target}
        settings={settings}
        history={history}
        challenge={challenge && target.mode === 'daily' && target.number === challenge.number ? challenge : null}
        onSolved={onSolved}
        goTo={goTo}
        nextPractice={nextPractice}
        openArchive={() => setModal('archive')}
        setToast={setToast}
      />

      <footer className="foot">
        <p>A new puzzle every day at midnight. Every puzzle has exactly one solution.</p>
      </footer>

      {toast && (
        <div className="toast" role="alert">
          {toast}
        </div>
      )}

      {(modal === 'welcome' || modal === 'help') && (
        <Modal title="How to play" onClose={closeModal}>
          <HowToPlay
            onPlay={() => {
              closeModal()
              if (target.mode === 'tutorial') goTo(dailyFor(today()))
            }}
            onTutorial={() => {
              save('seen-intro', true)
              goTo(tutorialPuzzle(0))
            }}
          />
        </Modal>
      )}
      {modal === 'stats' && (
        <Modal title="Statistics" onClose={closeModal}>
          <StatsPanel history={history} />
        </Modal>
      )}
      {modal === 'archive' && (
        <Modal title="Archive" onClose={closeModal} wide>
          <ArchivePanel history={history} onPickDay={(d) => goTo(dailyFor(d))} onPractice={(s) => nextPractice(s)} />
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
  settings: Settings
  history: History
  challenge: Challenge | null
  onSolved(t: PlayTarget, record: { ms: number; hints: number; backtracks: number; size: number }): void
  goTo(t: PlayTarget): void
  nextPractice(size: PracticeSize, currentId?: string): void
  openArchive(): void
  setToast(text: string | null): void
}

function PlayView({ target, settings, history, challenge, onSolved, goTo, nextPractice, openArchive, setToast }: PlayViewProps) {
  const session = useSession(target.puzzle)
  const { game, data } = session
  const { puzzle } = target

  const [hintCell, setHintCell] = useState<number | null>(null)
  const [rewindOffer, setRewindOffer] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [shake, setShake] = useState<number | null>(null)
  const [celebrate, setCelebrate] = useState(0)
  const [winOpen, setWinOpen] = useState(false)
  const [copyFallback, setCopyFallback] = useState<string | null>(null)

  useEffect(() => {
    track('puzzle_start', { mode: target.mode, id: puzzle.id, size: puzzle.rows })
  }, [target.mode, puzzle.id, puzzle.rows])

  // Route changed: drop stale hint notes.
  const head = data.route[data.route.length - 1]
  useEffect(() => {
    setHintCell((h) => (h === head ? null : h))
    setNote(null)
  }, [head, data.route.length])

  useEffect(() => {
    if (shake === null) return
    const id = window.setTimeout(() => setShake(null), 400)
    return () => window.clearTimeout(id)
  }, [shake])

  // Solved during this visit (not restored as already solved): record + celebrate.
  const alreadySolved = useRef(data.solved)
  useEffect(() => {
    if (!data.solved || alreadySolved.current) return
    alreadySolved.current = true
    onSolved(target, { ms: data.elapsedMs, hints: data.hints, backtracks: data.backtracks, size: puzzle.rows })
    track('puzzle_complete', {
      mode: target.mode, id: puzzle.id, size: puzzle.rows, ms: Math.round(data.elapsedMs),
      hints: data.hints, backtracks: data.backtracks,
    })
    playWin()
    haptic.win()
    setCelebrate((c) => c + 1)
  }, [data.solved, data.elapsedMs, data.hints, data.backtracks, puzzle.id, puzzle.rows, target, onSolved])

  useEffect(() => {
    if (!celebrate) return
    const id = window.setTimeout(() => setWinOpen(true), 1100)
    return () => window.clearTimeout(id)
  }, [celebrate])

  // ---- derived board state
  const targets = useMemo(() => new Set(data.solved ? [] : legalTargets(game, data.route)), [game, data.route, data.solved])
  const stranded = useMemo(() => new Set(data.solved ? [] : strandedCells(game, data.route)), [game, data.route, data.solved])
  const exits = useMemo(
    () => (settings.showExits && !data.solved ? exitCounts(game, data.route) : null),
    [settings.showExits, game, data.route, data.solved],
  )
  const nextNum = nextWaypoint(game, data.route) + 1
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
    const idx = data.route.indexOf(cell)
    if (idx >= 0) {
      if (idx < data.route.length - 1) {
        session.rewindTo(idx)
        setRewindOffer(null)
        playUndo()
        track('backtrack', { kind: 'rewind' })
      }
      return
    }
    const err = session.jump(cell)
    if (err) {
      const text = errorText(err)
      if (text) {
        setToast(text)
        setShake(cell)
        playError()
        haptic.error()
      }
      return
    }
    if (data.route.length === 1) track('first_move', { id: puzzle.id })
    setRewindOffer(null)
    if (game.waypointIndex.has(cell)) {
      playWaypoint()
      haptic.waypoint()
    } else {
      playJump(data.route.length / game.total)
      haptic.jump()
    }
  }

  const onUndo = () => {
    if (data.route.length > 1 && !data.solved) {
      session.undo()
      playUndo()
      track('backtrack', { kind: 'undo' })
    }
  }

  const onRestart = () => {
    if (data.route.length > 1 && !data.solved) {
      session.restart()
      setRewindOffer(null)
      track('backtrack', { kind: 'restart' })
    }
  }

  const onHint = () => {
    const h = session.hint()
    track('hint', { id: puzzle.id, kind: h.kind })
    if (h.kind === 'next') {
      setHintCell(h.cell)
      setRewindOffer(null)
      setNote('Try the highlighted square.')
    } else if (h.kind === 'rewind') {
      setHintCell(h.cell)
      setRewindOffer(h.index)
      setNote(
        h.index === 0
          ? 'Your route went off course with the first jump.'
          : `Your route went off course after move ${h.index + 1}.`,
      )
    }
  }

  // ---- labels and sharing
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
    if (kind === 'result' && typeof nav.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches) {
      try {
        await nav.share({ text })
        return
      } catch {
        // fall through to copying
      }
    }
    if (await copyText(text)) {
      setToast(kind === 'race' ? 'Race link copied. Send it to a friend.' : 'Result copied. Paste it anywhere.')
      setCopyFallback(null)
    } else {
      setCopyFallback(text)
    }
  }

  const streak = useMemo(() => summarize(history, today()).streak.current, [history])

  const winInfo: WinInfo = {
    heading: target.mode === 'tutorial' ? 'Nicely done' : target.mode === 'daily' ? `No. ${target.number} solved` : 'Solved',
    ms: data.elapsedMs,
    hints: data.hints,
    backtracks: data.backtracks,
    pace: paceEmoji(splitsMs),
    streak: target.mode === 'daily' && target.day === today() ? streak : undefined,
    challengeResult: challenge
      ? (() => {
          const theirs = challenge.splits[4] * 1000
          const diff = Math.abs(theirs - data.elapsedMs)
          return data.elapsedMs <= theirs
            ? `You beat your friend’s ${formatTime(theirs)} by ${formatTime(diff)}.`
            : `Your friend’s ${formatTime(theirs)} holds, by ${formatTime(diff)}.`
        })()
      : undefined,
    shareText:
      target.mode === 'tutorial'
        ? undefined
        : shareText({ label: shareLabel, ms: data.elapsedMs, hints: data.hints, backtracks: data.backtracks, splitsMs, url: raceUrl }),
    isDaily: target.mode === 'daily',
    isTutorial: target.mode === 'tutorial',
    hasNextTutorial: target.mode === 'tutorial' && (target.step ?? 0) < TUTORIAL_STEPS - 1,
    isPractice: target.mode === 'practice',
  }

  // ---- status line
  let status: string
  if (data.solved) status = `Solved in ${formatTime(data.elapsedMs)}.`
  else if (note) status = note
  else if (stranded.size) status = 'A square is cut off. Rewind to free it.'
  else if (targets.size === 0) status = 'No jumps left. Undo, or tap an earlier square to rewind.'
  else if (data.route.length === 1) status = 'Start on 1. Tap a glowing square to jump.'
  else if (nextNum === finishNum) status = `Cover the rest, then finish on ${finishNum}.`
  else status = `Next number: ${nextNum}`

  const isToday = target.mode === 'daily' && target.day === today()

  return (
    <main className="play">
      <section className="meta" aria-label="Puzzle">
        <div className="meta-left">
          <p className="meta-title">
            {target.mode === 'daily' && (
              <>
                No. {target.number}{' '}
                <span className="meta-day">{isToday ? dayName : `${dayName} ${target.day?.slice(5)}`}</span>
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
            Move {data.route.length}/{game.total}
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
              goTo(dailyFor(today()))
            }}
          >
            Skip tutorial
          </button>
        </aside>
      )}

      {challenge && !data.solved && <GhostBar challenge={challenge} session={session} />}

      <Board
        puzzle={puzzle}
        route={data.route}
        targets={targets}
        stranded={stranded}
        exits={exits}
        hintCell={hintCell}
        shakeCell={shake}
        solved={data.solved}
        celebrate={celebrate}
        onTap={onTap}
      />

      <div className="status" role="status" aria-live="polite" data-testid="status">
        <span>{status}</span>
        {rewindOffer !== null && !data.solved && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              session.rewindTo(rewindOffer)
              setRewindOffer(null)
              playUndo()
            }}
          >
            Rewind there
          </button>
        )}
        {data.solved && !winOpen && (
          <button type="button" className="link-btn" onClick={() => setWinOpen(true)}>
            See result
          </button>
        )}
      </div>

      <div className="controls">
        <button type="button" className="btn" onClick={onUndo} disabled={data.route.length <= 1 || data.solved}>
          <IconUndo size={18} /> Undo
        </button>
        <button type="button" className="btn" onClick={onRestart} disabled={data.route.length <= 1 || data.solved}>
          <IconRestart size={18} /> Restart
        </button>
        <button type="button" className="btn hint" onClick={onHint} disabled={data.solved}>
          <IconBulb size={18} /> Hint
        </button>
      </div>

      {!isToday && target.mode !== 'tutorial' && (
        <button type="button" className="link-btn back-today" onClick={() => goTo(dailyFor(today()))}>
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
                goTo(next < TUTORIAL_STEPS ? tutorialPuzzle(next) : dailyFor(today()))
              } else if (target.mode === 'practice') {
                nextPractice(String(puzzle.rows) as PracticeSize, puzzle.id)
              }
            }}
            onArchive={openArchive}
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
