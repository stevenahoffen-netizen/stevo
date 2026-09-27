# Knightline: Design

One daily knight's-path puzzle. Web first, then iOS via Capacitor.

## The rules (player-facing)

> Start on **1**. Jump like a chess knight. Land on **every open square exactly once**, passing the numbers **in order**. Finish on the **last number**.

- The board is a rectangle (5x5 to 7x7 for dailies) with a few blocked squares.
- Numbered squares ("waypoints") are 1 .. K. Waypoint 1 is the start, K is the finish.
- Every puzzle has **exactly one** solution, and it can be reached by reasoning alone (no guessing required).

No chess knowledge is needed: legal jumps glow from the current square.

## The core deduction we teach

"A square with only two ways in or out must use both." Corners on a knight board have exactly two knight moves, so the route through every corner is forced. Blocked squares create more of these. The tutorial teaches this one idea; the rest follows from it.

## Puzzle model

- Board `rows x cols`, `blocked: cell[]`, `waypoints: cell[]` (ordered, index 0 is 1), `solution: cell[]` (full path).
- Open cells form a knight graph. A solution is a Hamiltonian path on that graph that starts at waypoint 1, ends at waypoint K, and visits waypoints in increasing order.

## Solvers

Two solvers, both in `src/engine`:

1. **Exact solver** (`exact.ts`). Depth-first search over routes with strong pruning: waypoint order, "stranded square" detection (an unvisited square with no remaining way in), forced moves (a square with exactly two remaining connections, one of them the current square, must be next), and connectivity of the unvisited region. It counts solutions up to a limit (2) to prove uniqueness and to find alternative routes during generation.
2. **Logic solver** (`logic.ts`). Reasons about which *jumps* (edges) are on the route, the way a strong human would. Techniques, in increasing difficulty:
   - **L1 Forced**: a square that needs two route connections and has exactly two possible jumps uses both; a square that already has its connections rules out its other jumps. (Endpoints need one connection.)
   - **L2 Structure**: a jump that would close a loop is out; a jump that would connect start to finish before every square is covered is out; a jump that would put numbers out of order (e.g. 2 next to 4 with 3 elsewhere) is out.
   - **L3 Lookahead**: assume a jump, apply L1/L2 and a connectivity check; if that breaks the puzzle, the opposite is true.

   Because every deduction is sound, a puzzle the logic solver fully determines is provably unique. The hardest technique needed and the count of each technique define the difficulty grade.

## Generator

1. Pick blocked squares (180-degree rotational symmetry, looks designed), check the knight graph is connected and color parity allows a full path.
2. Find a random full route (randomized Warnsdorff search with backtracking).
3. Waypoints start as just 1 and K. While the logic solver (at the target technique level) cannot finish: if the exact solver finds a different route, add a waypoint where the two routes diverge; otherwise add one in the most undetermined region.
4. Prune: try removing each intermediate waypoint; keep it removed if the puzzle stays solvable at the target level. Easy tiers keep a few extra waypoints.
5. Grade and accept if inside the tier's target window; otherwise retry.

## Difficulty curve (local date, like Wordle)

| Day | Board | Tier | Logic allowed |
|---|---|---|---|
| Mon | 5x5 | Easy | L1-L2, extra waypoints |
| Tue | 5x5 | Medium | L1-L2 |
| Wed | 6x6 | Easy | L1-L2, extra waypoints |
| Thu | 6x6 | Medium | L1-L2 |
| Fri | 6x6 | Hard | L1-L3 |
| Sat | 7x7 | Medium | L1-L2 |
| Sun | 7x7 | Hard | L1-L3 |

Numbering: puzzle #1 is `EPOCH` (config). Content is pre-generated and validated offline, then bundled as JSON, so the app needs no server and works offline.

## Interaction

- Tap a glowing square to jump there. The route is drawn as straight lines between square centers; visited squares show their step number.
- Tap any earlier square on your route to rewind to it (counts as a backtrack). Undo steps back one. Restart clears the route.
- Illegal taps explain themselves: "Not a knight's jump", "Visit 3 first", "Finish here last".
- **Stranded warning**: an unvisited square with no remaining way in turns red. This is instant feedback a human would find tedious to compute, and it prevents long doomed routes without giving away the answer.
- Hints: if your route matches the solution so far, a hint highlights the next square. If it went wrong, the hint shows where it went off course and offers to rewind there.
- Optional assist (Settings): show the number of remaining exits on each open square.
- Timer starts on the first jump and pauses when the tab is hidden. Progress is saved locally and resumes.

## Share card (spoiler-free)

```
Knightline #12 ♞ Fri 6×6
⏱ 2:14 · 3 backtracks · no hints
🟩🟩🟨🟥🟩
https://knightline.app/#c=12.21.40.95.121.134
```

The five squares are split times: the route is cut into five equal parts and each square shows whether that part was quick (🟩), average (🟨) or slow (🟥) relative to your own pace. It tells a story ("stuck in the middle") without revealing any moves.

## Challenge link (ghost race)

The link carries only the puzzle number and five cumulative split times. A friend who opens it sees a ghost progress bar racing them in real time, then a result ("You beat Alex's time by 0:12"). Never moves, never the route. Uses the URL hash so it works on any static host.

## Streaks (forgiving)

- A streak counts consecutive local days with the daily solved.
- You start with 1 freeze and earn 1 more every 7 solved days (max 2 banked). A missed day uses a freeze instead of breaking the streak.
- Archive and practice solves don't count toward the streak.

## Modes

- **Daily**: one puzzle per day.
- **Archive**: past dailies. Free during the web beta (a config flag can lock older ones for the future app unlock).
- **Practice**: a pre-generated pool by board size.
- **Tutorial**: three tiny guided puzzles on first launch.

## Monetization plan (not in the web MVP)

- Web: free. Optional ads only after product-market signal.
- iOS: free daily; **$5.99 lifetime unlock** (archive, practice, bigger boards) and **$1.99 themed packs**, via RevenueCat. Apply to Apple's Small Business Program (15%).

## Metrics and kill criteria

Events (sent only if an analytics key is configured): `app_open`, `puzzle_start`, `first_move`, `hint`, `backtrack`, `puzzle_complete` (time, hints, backtracks, size, mode), `share`, `challenge_open`, `tutorial_complete`. An anonymous random id in local storage allows D1/D7 retention.

- **Playtest gate (weeks 1-2):** 15 non-chess players. Kill if the median 5x5 solve takes over 4 minutes or fewer than half finish.
- **Web launch gate (week 8):** 1,000+ organic daily players, D1 30%+, D7 8-10%+, 0.3+ shares per daily player. Otherwise stop before iOS.

## Tech

TypeScript, React, Vite. Vitest for engine tests, Playwright for end-to-end tests. Plain CSS with design tokens and dark mode. Content scripts run with `tsx`. iOS later via Capacitor (see `IOS.md`).
