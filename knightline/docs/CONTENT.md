# Content

All puzzles ship as JSON in `src/data/` and are generated offline, deterministically from seeds, so the same command always produces the same puzzles.

| File | Contents |
|---|---|
| `dailies.json` | One puzzle per day from `EPOCH` (2026-09-21, a Monday) to 2027-12-31. After that the list cycles. |
| `practice.json` | 50 puzzles each for 5x5, 6x6 and 7x7. |
| `tutorial.json` | Three tiny lessons: jump (3x4), numbers in order (4x5), corners (5x5). |

## The weekly curve

Defined in `src/engine/tiers.ts`. Current output (`npm run content:report`):

| Day | Board | Numbers (avg) | Bits of guessing (avg, range) | Real decisions | Lookahead steps | Notes |
|---|---|---|---|---|---|---|
| Mon | 5x5 | 5.9 | 4.4 (3.0-7.0) | 3.9 | 0 | one bonus number |
| Tue | 5x5 | 4.8 | 7.7 (6.0-10.0) | 6.4 | 1.2 | |
| Wed | 6x6 | 9.6 | 7.7 (6.0-9.9) | 6.1 | 0 | two bonus numbers: a gentle first 6x6 |
| Thu | 6x6 | 7.2 | 11.1 (9.0-13.9) | 8.4 | 0 | |
| Fri | 6x6 | 6.3 | 13.1 (11.1-16.5) | 9.8 | 4.8 | |
| Sat | 7x7 | 9.9 | 17.1 (14.2-20.0) | 13.0 | 0 | |
| Sun | 7x7 | 8.6 | 21.6 (18.1-27.4) | 16.4 | 8.8 | |

- **Bits of guessing**: walk the solution and, at each step, count the glowing squares that don't instantly create a dead end; add log2 of that count. Each bit is one real either/or the player has to reason out. This is what the weekday windows are set on.
- **Real decisions**: steps with two or more such choices.
- **Lookahead**: the logic solver had to assume a jump and find a contradiction, the hardest kind of step for a person.

Practice pools sit inside the same ranges: 5x5 averages 6.6 bits, 6x6 12.9, 7x7 19.5.

## Variety

- 617 of 617 layouts are distinct, even allowing for rotation, reflection and playing the route backwards.
- A route never comes back within 12 weeks (421 distinct routes across 467 dailies).
- Hole patterns are spread out: no 6x6 pattern takes more than 12% of 6x6 days, and no 7x7 pattern more than 5%. 5x5 boards only have a handful of patterns that make good puzzles (the most common is on 32% of 5x5 days), so there the generator relaxes the pattern cap after 60 tries; layouts still never repeat.

## Tutorial

Three lessons, chosen from 2,000 candidates each by simulating a wandering beginner: at most three glowing squares at a time (four on lesson 3), and any wrong jump shows a dead end within two or three moves.

1. **Jump** (3x4, just a start and a finish): every move is close to forced, so the only thing to learn is the L.
2. **In order** (4x5, 7 numbers): the route passes numbers it must not take yet, and at least one middle number is needed for the answer to be unique.
3. **Corners** (5x5 with four blocked squares, just a start and a finish): the route has to pick a corner over other glowing squares, and the open corners are outlined.

## Changing or extending content

```bash
npm run content:generate -- --until 2028-06-30   # extend the calendar
npm run content:validate                          # always run after generating
npm test                                          # includes a full content check
```

Rules for live content:

- **Never regenerate dates that players have already seen.** Changing a tier changes every puzzle generated from it. To tune difficulty after launch, change the tiers, generate into a scratch file, and splice in only future dates.
- The generator never reuses a layout, even rotated, mirrored or reversed.
- `npm run content:generate -- --only tutorial` rebuilds just the tutorial (a few seconds).

## Format

Each puzzle is stored compactly: board size, blocked squares, waypoints and the full solution, with cells encoded one character each (`src/engine/puzzle.ts`). The solution ships with the app so hints work offline. A determined player could read it from the bundle, which is acceptable for a free daily puzzle.
