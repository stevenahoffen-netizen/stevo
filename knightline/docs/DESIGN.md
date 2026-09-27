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

1. Pick blocked squares (180-degree rotational symmetry, looks designed). Reject boards with a square that has one jump or fewer, or where too many squares have only two (the board would solve itself).
2. Find a random full route (randomized Warnsdorff search with backtracking; the greedy rule is applied 70% of the time so routes vary). The two ends must be far apart: not adjacent, not a knight's jump apart.
3. Waypoints start as just 1 and K. While the logic solver (at the target technique level) cannot finish: if the exact solver finds a different route, add a waypoint where the two routes diverge; otherwise add one in the most undetermined region.
4. Prune: try removing each intermediate waypoint, giveaways first (consecutive numbers one jump apart), then latest first; keep it removed if the puzzle stays solvable at the target level. Easy tiers then add back a bonus number or two where it removes the least guessing.
5. Measure play difficulty and accept only inside the tier's window (below); otherwise retry.

### Play difficulty

Logic grades say what a solver *needs*; they don't say what a person *feels*. So every puzzle is also measured by walking its solution the way a careful player would:

- **bits**: at each step, count the glowing squares that don't instantly create a dead end (see the dead-end rule below) and add log2 of that count. 0 bits is a corridor; each bit is one coin-flip a player has to reason out.
- **first choices**: viable options on the very first jump (kept at 2-3 so the opening isn't a guess).
- **giveaways**: numbers k and k+1 one jump apart (a free move, capped per tier).
- **number density**: numbers as a share of squares (too many turns the puzzle into connect-the-dots).

Content rules across the whole calendar: no layout ever repeats (up to rotation, reflection and reversal), a route doesn't come back within 12 weeks, and no hole pattern takes more than about 12% of a board size's days (5x5 boards have few viable patterns, so they may exceed it; layouts still never repeat).

## Difficulty curve (local date, like Wordle)

| Day | Board | Tier | Logic allowed | Bits |
|---|---|---|---|---|
| Mon | 5x5 | Easy | L1-L2, 1 bonus number | 3-7 |
| Tue | 5x5 | Medium | L1-L3 (light) | 6-10 |
| Wed | 6x6 | Easy | L1-L2, 2 bonus numbers | 6-10 |
| Thu | 6x6 | Medium | L1-L2 | 9-14 |
| Fri | 6x6 | Hard | L1-L3 | 11-17 |
| Sat | 7x7 | Medium | L1-L2 | 14-20 |
| Sun | 7x7 | Hard | L1-L3 | 18-28 |

Numbering: puzzle #1 is `EPOCH` (config). Content is pre-generated and validated offline, then bundled as JSON, so the app needs no server and works offline.

## Interaction

- Tap a glowing square to jump there (open squares show a brass dot, numbers get a brass ring). The route is drawn as straight lines between square centers, recent jumps bold and older ones fading. Move numbers on visited squares are an option in Settings.
- Tap any earlier square on your route to rewind to it (counts as a backtrack); the status line says "Rewound 3 moves." with an Undo link that brings the route back. Undo steps back one. Restart clears the route (also undoable). Keyboard: U or Backspace undoes, H asks for a hint.
- Illegal taps explain themselves inline in the status line: "Knights jump in an L", "Reach 3 first", "Cover every other square first".
- **Dead-end warning**: an unvisited square with no way left, or (other than the finish) with only one way left so it could be entered but never left, turns red with an X. This is the corner rule applied instantly: it's sound (it never fires on a route that can still be finished), it catches most wrong turns the moment they happen, and it never gives away the right move.
- Hints: if your route matches the solution so far, a hint highlights the next square. If it went wrong, the hint highlights the last good square and offers to rewind there.
- Optional assist (Settings): show the number of remaining exits on each open square.
- Timer starts on the first jump and pauses when the tab is hidden or a menu is open. Progress is saved locally and resumes. If the page stays open past midnight, an untouched daily moves to the new day; a started one stays put, with a link to the new puzzle.

## Share card (spoiler-free)

```
Knightline #12 ♞ Fri 6×6
⏱ 2:14 · 3 backtracks · no hints
🟩🟩🟨🟥🟩
https://knightline.app/#r12.21.40.95.121.134
```

The five squares are split times: the route is cut into five equal parts and each square shows whether that part was quick (🟩), average (🟨) or slow (🟥) relative to your own pace. It tells a story ("stuck in the middle") without revealing any moves.

## Challenge link (ghost race)

The link carries only the puzzle number and five cumulative split times (whole seconds, rounded down like the clock). A friend who opens it sees a ghost progress bar racing them in real time, then a result ("You beat your friend's 2:14 by 0:12", or a dead heat). Never moves, never the route. It uses a plain URL hash token (`#r<number>.<s1>...<s5>`, letters, digits and dots only) so it works on any static host, including sandboxed ones that drop `key=value` hashes. The app clears the token after reading it so a reload doesn't replay the race. First-time visitors from a race link get a short "You've been challenged" welcome; a link to a puzzle that isn't out yet says when it unlocks; a link to a puzzle you already solved goes straight to the verdict.

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
