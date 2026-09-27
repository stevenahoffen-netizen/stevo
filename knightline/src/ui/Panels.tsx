import { useEffect, useState } from 'react'
import { archiveDays, dailyFor, practicePool, today, type PracticeSize } from '../game/content'
import { WEEKDAY_NAMES, puzzleNumber, weekdayIndex } from '../data/schedule'
import { formatCountdown, formatTime, msUntilMidnight, plural } from '../game/format'
import { hapticsSupported } from '../game/haptics'
import type { Settings, ThemeChoice } from '../game/settings'
import { summarize, type History } from '../game/stats'
import { loadSavedSession } from '../game/useSession'
import { IconCheck, KNIGHT } from './icons'

// ---------------------------------------------------------------- how to play
export function HowToPlay({ onTutorial, onPlay }: { onTutorial(): void; onPlay(): void }) {
  return (
    <div className="howto">
      <ol className="rules">
        <li>
          <strong>Start on 1.</strong> The knight is already there.
        </li>
        <li>
          <strong>Jump like a chess knight:</strong> two squares one way, one square to the side. Squares you can
          reach glow.
        </li>
        <li>
          <strong>Land on every open square exactly once</strong>, passing the numbers in order.
        </li>
        <li>
          <strong>Finish on the last number.</strong>
        </li>
      </ol>
      <div className="demo" aria-hidden="true">
        <MiniKnight />
      </div>
      <p className="tip">
        Tip: a square with only two ways in or out must use both. Corners always work this way, so start your
        thinking there.
      </p>
      <p className="tip">Tap any earlier square on your route to rewind to it. A red square has been cut off.</p>
      <div className="row-actions">
        <button type="button" className="btn primary" onClick={onPlay} data-autofocus>
          Play today&rsquo;s puzzle
        </button>
        <button type="button" className="btn" onClick={onTutorial}>
          Quick tutorial
        </button>
      </div>
    </div>
  )
}

/** Small static diagram of the knight's eight jumps. */
function MiniKnight() {
  const n = 5
  return (
    <div className="mini" style={{ ['--n' as string]: n }}>
      {Array.from({ length: n * n }, (_, i) => {
        const dr = Math.abs(Math.floor(i / n) - 2)
        const dc = Math.abs((i % n) - 2)
        const isTarget = (dr === 1 && dc === 2) || (dr === 2 && dc === 1)
        const dark = (Math.floor(i / n) + (i % n)) % 2 === 1
        return (
          <span key={i} className={`mini-sq${dark ? ' dark' : ''}${isTarget ? ' target' : ''}`}>
            {i === 12 && <span className="mini-knight">{KNIGHT}</span>}
          </span>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- stats
export function StatsPanel({ history }: { history: History }) {
  const s = summarize(history, today())
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
      <p className="fine">
        Miss a day and a freeze saves your streak. You earn one every 7 daily solves (up to 2).
      </p>
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
  onPickDay,
  onPractice,
}: {
  history: History
  onPickDay(day: string): void
  onPractice(size: PracticeSize): void
}) {
  const days = archiveDays()
  const t = today()
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
              <span className="practice-count">
                {done}/{pool.length}
              </span>
            </button>
          )
        })}
      </div>
      <h3 className="eyebrow">Past dailies</h3>
      <ul className="days">
        {days.map((day) => {
          const target = dailyFor(day)
          const solved = history.dailies[day]
          const saved = !solved ? loadSavedSession(target.puzzle) : null
          const inProgress = !!saved && saved.route.length > 1
          const w = weekdayIndex(day)
          return (
            <li key={day}>
              <button type="button" className="day" onClick={() => onPickDay(day)}>
                <span className="day-num">#{puzzleNumber(day)}</span>
                <span className="day-name">
                  {day === t ? 'Today' : WEEKDAY_NAMES[w].slice(0, 3)} <span className="day-date">{day.slice(5)}</span>
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
  const toggle = (key: 'sound' | 'haptics' | 'showExits') => onChange({ ...settings, [key]: !settings[key] })
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
      <label className="toggle" htmlFor="set-exits">
        <span>
          Show exit counts
          <small>How many ways in or out each open square has left</small>
        </span>
        <input id="set-exits" type="checkbox" checked={settings.showExits} onChange={() => toggle('showExits')} />
      </label>
      <fieldset className="theme">
        <legend>Theme</legend>
        {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
          <label key={t} htmlFor={`theme-${t}`}>
            <input
              id={`theme-${t}`}
              type="radio"
              name="theme"
              checked={settings.theme === t}
              onChange={() => onChange({ ...settings, theme: t })}
            />
            {t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
          </label>
        ))}
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
}

export function WinPanel({
  info,
  onShare,
  onChallenge,
  onNext,
  onArchive,
}: {
  info: WinInfo
  onShare(): void
  onChallenge(): void
  onNext(): void
  onArchive(): void
}) {
  const [left, setLeft] = useState(msUntilMidnight())
  useEffect(() => {
    const id = window.setInterval(() => setLeft(msUntilMidnight()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="win">
      <p className="win-time">{formatTime(info.ms)}</p>
      <p className="win-sub">
        {plural(info.backtracks, 'backtrack')} · {info.hints === 0 ? 'no hints' : plural(info.hints, 'hint')}
      </p>
      {info.pace && (
        <p className="win-pace" aria-label="Pace for each fifth of the route">
          {info.pace}
        </p>
      )}
      {info.challengeResult && <p className="win-challenge">{info.challengeResult}</p>}
      {info.streak !== undefined && info.streak > 0 && (
        <p className="win-streak">
          <strong>{info.streak}</strong> day streak
        </p>
      )}
      {info.isTutorial ? (
        <div className="row-actions">
          <button type="button" className="btn primary" onClick={onNext} data-autofocus>
            {info.hasNextTutorial ? 'Next lesson' : 'Play today’s puzzle'}
          </button>
        </div>
      ) : (
        <>
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
                Copy race link
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
          {info.isDaily && <p className="fine next-in">Next puzzle in {formatCountdown(left)}</p>}
        </>
      )}
    </div>
  )
}

