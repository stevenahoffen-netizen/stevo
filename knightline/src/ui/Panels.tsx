import { useEffect, useState } from 'react'
import { archiveDays, dailyFor, practicePool, type PracticeSize } from '../game/content'
import { WEEKDAY_NAMES, puzzleNumber, weekdayIndex } from '../data/schedule'
import { formatCountdown, formatTime, msUntilMidnight, plural, shortDate } from '../game/format'
import { hapticsSupported } from '../game/haptics'
import type { Settings, ThemeChoice } from '../game/settings'
import { summarize, type History } from '../game/stats'
import { loadSavedSession } from '../game/useSession'
import { IconCheck, KNIGHT } from './icons'

// ---------------------------------------------------------------- how to play
export type IntroVariant = 'first' | 'help' | 'race'

export function HowToPlay({
  variant,
  onTutorial,
  onPlay,
}: {
  variant: IntroVariant
  onTutorial(): void
  onPlay(): void
}) {
  return (
    <div className="howto">
      {variant === 'race' && (
        <p className="race-intro">
          A friend sent you a race. Their time runs as a ghost bar once you make your first jump.
        </p>
      )}
      <MiniKnight />
      <ol className="rules">
        <li>
          <strong>Start on 1 and jump like a chess knight:</strong> an L, two squares one way and one to the side.
          Squares you can reach glow.
        </li>
        <li>
          <strong>Land on every open square exactly once</strong>, passing the numbers in order.
        </li>
        <li>
          <strong>Finish on the last number</strong> (it has a double ring).
        </li>
      </ol>
      <p className="tip">
        Stuck? A corner has only two jumps, so the route must use both. A red square is a dead end: tap an earlier
        square on your route to rewind.
      </p>
      <p className="fine">A new puzzle every day at midnight. Every puzzle has exactly one solution.</p>
      <div className="row-actions">
        {variant === 'help' ? (
          <>
            <button type="button" className="btn primary" onClick={onPlay} data-autofocus>
              Got it
            </button>
            <button type="button" className="btn" onClick={onTutorial}>
              Replay tutorial
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn primary" onClick={onTutorial} data-autofocus>
              Show me (1 minute)
            </button>
            <button type="button" className="btn" onClick={onPlay}>
              {variant === 'race' ? 'Start the race' : 'Skip to today’s puzzle'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** The knight's eight jumps, with one L drawn out. */
function MiniKnight() {
  const n = 5
  return (
    <div className="demo" aria-hidden="true">
      <div className="mini" style={{ ['--n' as string]: n }}>
        {Array.from({ length: n * n }, (_, i) => {
          const dr = Math.abs(Math.floor(i / n) - 2)
          const dc = Math.abs((i % n) - 2)
          const isTarget = (dr === 1 && dc === 2) || (dr === 2 && dc === 1)
          const dark = (Math.floor(i / n) + (i % n)) % 2 === 1
          return (
            <span key={i} className={`mini-sq${dark ? ' dark' : ''}`}>
              {isTarget && <span className="mini-dot" />}
              {i === 12 && <span className="mini-knight">{KNIGHT}</span>}
            </span>
          )
        })}
        <svg className="mini-path" viewBox="0 0 5 5">
          <polyline points="2.5,2.5 2.5,0.5 3.5,0.5" />
        </svg>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stats
export function StatsPanel({ history, today }: { history: History; today: string }) {
  const s = summarize(history, today)
  const sizes = Object.entries(s.bySize).sort(([a], [b]) => Number(a) - Number(b))
  return (
    <div className="stats">
      <dl className="tiles">
        <div>
          <dt>Solved</dt>
          <dd>{s.played}</dd>
        </div>
        <div>
          <dt>Streak</dt>
          <dd>{s.streak.current}</dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd>{s.streak.best}</dd>
        </div>
        <div>
          <dt>Freezes</dt>
          <dd>{s.streak.freezes}</dd>
        </div>
      </dl>
      <p className="fine">Miss a day and a freeze saves your streak. You earn one every 7 daily solves (up to 2).</p>
      {sizes.length > 0 ? (
        <table className="times">
          <thead>
            <tr>
              <th scope="col">Board</th>
              <th scope="col">Solved</th>
              <th scope="col">Best</th>
              <th scope="col">Average</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map(([size, v]) => (
              <tr key={size}>
                <td>
                  {size}×{size}
                </td>
                <td>{v.count}</td>
                <td>{formatTime(v.best)}</td>
                <td>{formatTime(v.avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="fine">Solve a puzzle to see your times here.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- archive + practice
export function ArchivePanel({
  history,
  today,
  onPickDay,
  onPractice,
}: {
  history: History
  today: string
  onPickDay(day: string): void
  onPractice(size: PracticeSize): void
}) {
  const days = archiveDays(today)
  return (
    <div className="archive">
      <h3 className="eyebrow">Practice</h3>
      <div className="practice-row">
        {(['5', '6', '7'] as const).map((size) => {
          const pool = practicePool(size)
          const done = pool.filter((p) => history.practice[p.id]).length
          return (
            <button key={size} type="button" className="btn practice" onClick={() => onPractice(size)}>
              <span className="practice-size">
                {size}×{size}
              </span>
              <span className="practice-count">{done}/{pool.length} solved</span>
            </button>
          )
        })}
      </div>
      <h3 className="eyebrow">Past dailies</h3>
      <ul className="days">
        {days.map((day) => {
          const target = dailyFor(day)
          const solved = history.dailies[day]
          const saved = !solved ? loadSavedSession(target.sessionId) : null
          const inProgress = !!saved && saved.route.length > 1
          const w = weekdayIndex(day)
          return (
            <li key={day}>
              <button type="button" className="day" onClick={() => onPickDay(day)}>
                <span className="day-num">#{puzzleNumber(day)}</span>
                <span className="day-name">
                  {day === today ? 'Today' : WEEKDAY_NAMES[w].slice(0, 3)} <span className="day-date">{shortDate(day)}</span>
                </span>
                <span className="day-size">
                  {target.puzzle.rows}×{target.puzzle.cols}
                </span>
                <span className="day-state">
                  {solved ? (
                    <span className="done">
                      <IconCheck size={16} /> {formatTime(solved.ms)}
                    </span>
                  ) : inProgress ? (
                    'Started'
                  ) : (
                    ''
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- settings
export function SettingsPanel({
  settings,
  onChange,
  onReset,
}: {
  settings: Settings
  onChange(s: Settings): void
  onReset(): void
}) {
  const [confirming, setConfirming] = useState(false)
  const toggle = (key: 'sound' | 'haptics' | 'showExits' | 'showSteps') => onChange({ ...settings, [key]: !settings[key] })
  return (
    <div className="settings">
      <label className="toggle" htmlFor="set-sound">
        <span>
          Sound
          <small>Soft clicks and chimes</small>
        </span>
        <input id="set-sound" type="checkbox" checked={settings.sound} onChange={() => toggle('sound')} />
      </label>
      {hapticsSupported && (
        <label className="toggle" htmlFor="set-haptics">
          <span>
            Vibration
            <small>A light tap on each jump</small>
          </span>
          <input id="set-haptics" type="checkbox" checked={settings.haptics} onChange={() => toggle('haptics')} />
        </label>
      )}
      <label className="toggle" htmlFor="set-steps">
        <span>
          Show move numbers
          <small>Small numbers on squares you’ve visited</small>
        </span>
        <input id="set-steps" type="checkbox" checked={settings.showSteps} onChange={() => toggle('showSteps')} />
      </label>
      <label className="toggle" htmlFor="set-exits">
        <span>
          Show exit counts
          <small>How many ways in or out each open square has left</small>
        </span>
        <input id="set-exits" type="checkbox" checked={settings.showExits} onChange={() => toggle('showExits')} />
      </label>
      <fieldset className="theme">
        <legend>Theme</legend>
        <div className="segmented">
          {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
            <label key={t} htmlFor={`theme-${t}`}>
              <input
                id={`theme-${t}`}
                type="radio"
                name="theme"
                checked={settings.theme === t}
                onChange={() => onChange({ ...settings, theme: t })}
              />
              <span>{t === 'system' ? 'Device' : t === 'light' ? 'Light' : 'Dark'}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="danger-zone">
        {confirming ? (
          <>
            <p>This deletes your streak, times and saved progress on this device.</p>
            <div className="row-actions">
              <button type="button" className="btn danger" onClick={onReset}>
                Delete everything
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="btn ghost" onClick={() => setConfirming(true)}>
            Reset progress
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- win
export interface WinInfo {
  heading: string
  ms: number
  hints: number
  backtracks: number
  pace: string
  streak?: number
  challengeResult?: string
  shareText?: string
  isDaily: boolean
  isTutorial: boolean
  hasNextTutorial: boolean
  isPractice: boolean
  /** a newer daily is already out (the page stayed open past midnight) */
  newDailyOut: boolean
}

export function WinPanel({
  info,
  onShare,
  onChallenge,
  onNext,
  onArchive,
  onToday,
}: {
  info: WinInfo
  onShare(): void
  onChallenge(): void
  onNext(): void
  onArchive(): void
  onToday(): void
}) {
  const [left, setLeft] = useState(msUntilMidnight())
  useEffect(() => {
    const id = window.setInterval(() => setLeft(msUntilMidnight()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (info.isTutorial) {
    return (
      <div className="win">
        <p className="win-lead">{info.hasNextTutorial ? 'That’s the idea. One more thing to learn.' : 'You’re ready for the real thing.'}</p>
        <div className="row-actions">
          <button type="button" className="btn primary" onClick={onNext} data-autofocus>
            {info.hasNextTutorial ? 'Next lesson' : 'Play today’s puzzle'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="win">
      <p className="win-time">{formatTime(info.ms)}</p>
      <p className="win-sub">
        {plural(info.backtracks, 'backtrack')} · {info.hints === 0 ? 'no hints' : plural(info.hints, 'hint')}
      </p>
      {info.pace && (
        <>
          <p className="win-pace" aria-label="Your pace on each fifth of the route">
            {info.pace}
          </p>
          <p className="fine pace-legend">One square per fifth of your route: 🟩 quick · 🟨 steady · 🟥 slow</p>
        </>
      )}
      {info.challengeResult && <p className="win-challenge">{info.challengeResult}</p>}
      {info.streak !== undefined && info.streak > 0 && (
        <p className="win-streak">
          <strong>{info.streak}</strong> day streak
        </p>
      )}
      {info.shareText && (
        <pre className="share-preview" aria-label="Share preview">
          {info.shareText}
        </pre>
      )}
      <div className="row-actions">
        <button type="button" className="btn primary" onClick={onShare} data-autofocus>
          Share result
        </button>
        {info.isDaily && (
          <button type="button" className="btn" onClick={onChallenge}>
            Race a friend
          </button>
        )}
      </div>
      <div className="row-actions">
        {info.isPractice ? (
          <button type="button" className="btn ghost" onClick={onNext}>
            Next practice puzzle
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={onArchive}>
            Archive and practice
          </button>
        )}
      </div>
      {info.isDaily &&
        (info.newDailyOut ? (
          <p className="fine next-in">
            Today’s puzzle is out.{' '}
            <button type="button" className="link-btn" onClick={onToday}>
              Play it
            </button>
          </p>
        ) : (
          <p className="fine next-in">Next puzzle in {formatCountdown(left)}</p>
        ))}
    </div>
  )
}
