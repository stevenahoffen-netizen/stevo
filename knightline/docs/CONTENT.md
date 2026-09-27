# Content

All puzzles ship as JSON in `src/data/` and are generated offline, deterministically from seeds, so the same command always produces the same puzzles.

| File | Contents |
|---|---|
| `dailies.json` | One puzzle per day from `EPOCH` (2026-09-21, a Monday) to 2027-12-31. After that the list cycles. |
| `practice.json` | 50 puzzles each for 5x5, 6x6 and 7x7. |
| `tutorial.json` | Three tiny lessons: jump and cover (3x4), numbers in order (4x5), corners (5x5). |

## The weekly curve

Defined in `src/engine/tiers.ts`. Current output (`npm run content:report`):

| Day | Board | Numbers (avg) | Lookahead steps | Notes |
|---|---|---|---|---|
| Mon | 5x5 | 5.8 | 0 | one bonus number |
| Tue | 5x5 | 5.5 | 1-4 | |
| Wed | 6x6 | 10.0 | 0 | two bonus numbers |
| Thu | 6x6 | 8.4 | 0 | |
| Fri | 6x6 | 7.4 | 2-8 | |
| Sat | 7x7 | 12.3 | 0 | |
| Sun | 7x7 | 10.9 | 3-12 | |

"Lookahead" means the logic solver had to assume a jump and find a contradiction, which is the hardest kind of step for a person.

## Changing or extending content

```bash
npm run content:generate -- --until 2028-06-30   # extend the calendar
npm run content:validate                          # always run after generating
npm test                                          # includes a full content check
```

Rules for live content:

- **Never regenerate dates that players have already seen.** Changing a tier changes every puzzle generated from it. To tune difficulty after launch, change the tiers, generate into a scratch file, and splice in only future dates.
- The generator skips any puzzle identical to one already produced.
- Tutorial puzzles are chosen for the fewest numbers among 40 seeds per lesson.

## Format

Each puzzle is stored compactly: board size, blocked squares, waypoints and the full solution, with cells encoded one character each (`src/engine/puzzle.ts`). The solution ships with the app so hints work offline. A determined player could read it from the bundle, which is acceptable for a free daily puzzle.
