# Shipping DELVE to TestFlight

The game is a self-contained static web app, designed to wrap cleanly in
[Capacitor](https://capacitorjs.com). This is the path from this repo to
a TestFlight build. Steps below run on a Mac with Xcode 15+.

## 1. Wrap in Capacitor

```sh
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Delve" "com.yourteam.delve" --web-dir .
npx cap add ios
npx cap sync
npx cap open ios
```

Notes:

- `--web-dir .` — the repo root IS the web build; there is no bundler.
- Capacitor serves over a local custom scheme, so `getImageData` (skin
  recoloring) and `localStorage` both work without the file:// caveats.

## 2. iOS project settings

In Xcode:

- **Display name**: Delve. **Bundle ID**: match App Store Connect.
- **Deployment target**: iOS 14+.
- **Device orientation**: Portrait only (the layout is portrait-first).
- **Status bar**: hidden or dark content; the page already handles
  `viewport-fit=cover` and safe-area insets.
- **App icon**: `icons/icon-1024.png` is the 1024 master; drop it into
  the asset catalog (Xcode 14+ generates all sizes from the single 1024).
- **Launch screen**: solid `#08090e` background matches the game's boot.

## 3. Native integrations (post-wrap, before public release)

Each has a stub in `js/platform.js` — wire them behind that interface so
the game code doesn't change:

| Feature | Plugin | Notes |
|---|---|---|
| Haptics | `@capacitor/haptics` | replace `Platform.haptic` |
| IAP | `capacitor-plugin-purchase` / StoreKit 2 | SKUs in MONETIZATION.md; flip `Platform.iap.available` |
| Rewarded ads | AdMob (`@capacitor-community/admob`) | non-personalized config; replace the simulated ad in `js/shop.js` |
| Game Center | `capacitor-game-connect` | submit `challenge.best` and `timed.bests[0].ms`; leaderboard IDs `delve.depth`, `delve.rush` |
| Robust saves | `@capacitor/preferences` | mirror the `delve_save_v1` blob out of localStorage (WKWebView can evict localStorage under storage pressure) |

The save-mirroring one is the only *required* item before TestFlight —
losing progress is the one unforgivable bug. A 10-line adapter in
`js/save.js` (`write()` → also `Preferences.set`) covers it.

## 4. TestFlight

1. Archive in Xcode (Any iOS Device), upload via Organizer.
2. In App Store Connect: create the app, fill in the privacy
   questionnaire — **no data collected** (saves are on-device; if AdMob
   ships in the build, declare its SDK per Google's current guidance).
3. Add internal testers; external testers need Beta App Review (usually
   <24 h for a game like this).

## 5. Pre-flight QA checklist

- [ ] Fresh install: title → intro cards → 1-1, audio starts on first tap
- [ ] Kill the app mid-level; relaunch resumes with progress intact
- [ ] Complete a chapter; relaunch; relic persists and gates work
- [ ] Challenge run-over, leaderboard entry appears, survives relaunch
- [ ] Timed full run on a physical device (timer accuracy)
- [ ] Shop purchase + equip each skin and theme; relaunch keeps them
- [ ] Mute switch: game audio respects the physical ring/silent switch
  (set AVAudioSession category `ambient` in AppDelegate)
- [ ] iPhone SE (small) and iPad (large) layouts
- [ ] VoiceOver: canvas game is not screen-reader navigable — this is a
  known limitation; ensure at minimum the app doesn't trap VoiceOver
  users on launch (title screen advances on any tap)
