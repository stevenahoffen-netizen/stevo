# iOS roadmap (Capacitor)

The web app is built to be wrapped with Capacitor once the web test passes its gate (see PLAYTEST.md). This is the checklist.

## 1. Accounts (week 1)

- Apple Developer Program: $99/year.
- Apply for the **App Store Small Business Program** (15% commission instead of 30%). It is not automatic.
- RevenueCat (free under $2.5k/month in revenue) for the in-app purchase.

## 2. Wrap the app

```bash
npm i @capacitor/core @capacitor/ios @capacitor/haptics @capacitor/local-notifications @capacitor/preferences
npm i -D @capacitor/cli
npx cap add ios          # uses capacitor.config.json in this folder
npm run build && npx cap sync ios
```

No Mac? Build in the cloud: Codemagic (500 free macOS minutes a month) or GitHub Actions macOS runners can build, sign and upload to TestFlight. You still need an iPhone to test on.

## 3. Changes needed before App Review

Apple rejects "repackaged websites" under Guideline 4.2, so the app must work fully offline and feel native:

- **Bundle the fonts** instead of loading Google Fonts: `npm i @fontsource/figtree @fontsource/ibm-plex-mono @fontsource/young-serif`, import them in `src/main.tsx`, and remove the `<link>` in `index.html`.
- **Haptics:** swap `src/game/haptics.ts` to `@capacitor/haptics` (web vibration doesn't exist on iOS).
- **Storage:** move `src/game/storage.ts` to `@capacitor/preferences` so iOS doesn't clear progress under storage pressure.
- **Daily reminder:** a local notification at a time the player picks ("Today's Knightline is ready"). Ask for permission only after the first solve, never on launch.
- **Share:** use the native share sheet (`@capacitor/share`) and the App Store link instead of the web URL.
- **Game Center** (optional, via a community plugin) for streak achievements.
- Turn off text selection and pinch zoom (already disabled on the board), and test on a small old iPhone.

Guideline 4.3 (copycats): the knight-path twist must show in the first screenshot, and don't use "Zip", "Queens", "LinkedIn" or "Wordle" in the name, subtitle or keywords.

## 4. Monetization

- Free: the daily, forever, no ads.
- **Knightline Pro, $5.99 one-time:** full archive, practice packs, 8x8 boards. Gate it in `ArchivePanel` (a config flag already exists conceptually for locking older dailies).
- **Theme packs, $1.99** later (piece sets, board styles).
- Set up with RevenueCat's Capacitor SDK. Include "Restore purchases" in Settings.

## 5. Store listing

- Name (30 chars): "Knightline: Daily Knight Puzzle"
- Subtitle (30): "A fresh logic puzzle every day"
- Keywords (100): "knight,chess,puzzle,daily,logic,brain,tour,path,numbers,offline,no ads,grid"
- Screenshots: first one shows the board mid-route with the glowing jumps and the line "Jump like a knight. Land on every square."
- File a **Featuring Nomination** in App Store Connect 4-6 weeks before launch, pitching uniqueness, accessibility (VoiceOver labels, keyboard play) and the daily ritual.

## 6. Privacy

No accounts, no ads, no tracking across apps, so no ATT prompt. If PostHog analytics stay on, declare "Product Interaction / Analytics, not linked to identity" in the privacy nutrition label and add a privacy policy URL.
