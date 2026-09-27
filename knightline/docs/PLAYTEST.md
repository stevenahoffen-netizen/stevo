# Playtest plan

The goal of the first two weeks is to find out whether strangers enjoy Knightline enough to come back tomorrow. Everything else waits on that.

## Week 1: watch people play (15 players)

Recruit 15 people who are **not** chess players and **not** your close friends if you can help it (dorm neighbours' parents, classmates from other houses, anyone who plays Wordle or LinkedIn's games). Roughly half should be over 30: that's the real daily-puzzle audience.

Protocol for each session (10 minutes):

1. Hand them your phone on the first-visit screen. Say only: "This is a daily puzzle game. Think out loud." Don't explain the rules.
2. Watch silently. Write down: seconds until the first correct jump, where they hesitate, what they tap that doesn't work, whether they read the how-to-play text or skip it, whether they choose the tutorial.
3. Let them try Monday-level (5x5) and one 6x6. Note time, hints and backtracks (the win screen shows them).
4. Ask three questions afterwards:
   - "What was the hardest part?"
   - "Would you play again tomorrow? Why or why not?"
   - "Who would you send this to?"

**Kill or change the mechanic if:** the median 5x5 solve is over 4 minutes, fewer than half finish a 5x5 without hints, or most people say the lines are hard to follow. Changing the art won't fix those; the rules or board sizes would have to change.

## Week 2+: open web test

Deploy with analytics on (`VITE_POSTHOG_KEY`, see README) and post to r/puzzles, r/WebGames, and puzzle newsletters. Events captured:

| Event | Why it matters |
|---|---|
| `app_open` | Daily active players; anonymous id gives D1/D7 retention |
| `puzzle_start`, `first_move` | Drop-off before playing (confusing first screen?) |
| `puzzle_complete` (ms, hints, backtracks, size) | Real difficulty by weekday; tune `src/engine/tiers.ts` |
| `hint`, `backtrack` | Where people get stuck |
| `share`, `challenge_open` | Whether the share card and race links spread |
| `tutorial_complete` | Whether the tutorial is worth its spot |

**Continue to iOS only if**, by week 8: 1,000+ organic daily players, D1 retention 30%+, D7 8-10%+, and 0.3+ shares per daily player. Otherwise, keep the engine and try the next game idea on it.

## Difficulty calibration

The generator's difficulty score is a starting point, not the truth. Once you have 200+ completions per weekday, compare median solve times with the intended curve (Mon easiest, Sun hardest). If a weekday is out of order, adjust its tier in `src/engine/tiers.ts` (board size, lookahead limits, bonus numbers), regenerate, and re-validate. Only regenerate dates in the future, so past puzzles don't change under players.
