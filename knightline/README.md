# Knightline

A daily knight's-path logic puzzle. Start on 1, jump like a chess knight, land on every open square exactly once, pass the numbers in order, and finish on the last number. Every puzzle has exactly one solution, and every one can be solved by reasoning alone.

Web first (this repo), then iOS via Capacitor (see [docs/IOS.md](docs/IOS.md)).

## Quick start

```bash
npm install
npm run dev          # local dev server
npm test             # engine + content + game logic tests (Vitest)
npm run test:e2e     # browser tests on phone and desktop viewports (Playwright)
npm run build        # production build into dist/
```

## What's in the box

| Area | Where | Notes |
|---|---|---|
| Puzzle engine | `src/engine/` | Knight graph, exact solver (proves uniqueness), human-style logic solver (grades difficulty), generator |
| Content | `src/data/*.json` | 467 dailies (Sep 21 2026 to Dec 31 2027), 150 practice, 3 tutorial puzzles. Pre-generated and validated |
| Game logic | `src/game/` | Session (route, timer, hints, splits, saved progress), streaks, share text, race links, settings, sound, analytics |
| UI | `src/ui/` | Board, dialogs, panels. Plain CSS with light/dark tokens in `src/styles.css` |
| Scripts | `scripts/` | Generate, validate and report on content; render icons; single-file build |
| Docs | `docs/` | [Design](docs/DESIGN.md), [content](docs/CONTENT.md), [playtest plan](docs/PLAYTEST.md), [iOS roadmap](docs/IOS.md) |

## How puzzles are made (short version)

1. Pick symmetric blocked squares and find a random full knight route.
2. Add numbered waypoints until the **logic solver** can finish the puzzle using only sound deductions (that proves the solution is unique), then remove every waypoint that isn't needed.
3. Grade by the hardest technique needed: *forced* squares, *structure* (no loops, numbers in order), or *lookahead*.
4. Measure how it *plays*: walk the solution and count the real choices a careful player faces (in bits of guessing). Each weekday has a window, so Monday stays gentle and Sunday stays a fight.
5. Keep the calendar varied: no layout ever repeats, even rotated or mirrored.
6. Re-prove everything offline with an **exhaustive exact search** before shipping.

Both solvers are cross-checked against brute force on hundreds of small boards in `src/engine/engine.test.ts`.

## Content commands

```bash
npm run content:generate   # regenerate all puzzle JSON (deterministic from seeds, ~20 min)
npm run content:validate   # re-prove every puzzle: valid, unique, logic-solvable
npm run content:report     # difficulty by weekday + sample boards
```

## Deploying the web version

`npm run build` produces a static site in `dist/` (relative paths, no server needed). Any static host works: Cloudflare Pages, Netlify, Vercel, GitHub Pages.

Optional build-time environment variables:

- `VITE_PUBLIC_URL`: canonical URL used in share and race links (defaults to the current page URL).
- `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST`: turn on anonymous analytics for the playtest metrics in [docs/PLAYTEST.md](docs/PLAYTEST.md). Without a key, analytics are a no-op.

`npm run build:artifact` packs everything, fonts included, into one HTML body (`dist-artifact/knightline.html`) for hosts that wrap pages themselves. Fonts are self-hosted (`src/fonts.css`), so neither build makes third-party requests.

## Status

Web MVP complete: daily, archive, practice, tutorial, hints, instant dead-end warnings, rewind with undo, share card with pace squares, ghost-race links, forgiving streaks, midnight rollover, light/dark, keyboard play (U undo, H hint). Next: playtest (see [docs/PLAYTEST.md](docs/PLAYTEST.md)), then iOS.
