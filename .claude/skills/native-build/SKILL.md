---
name: native-build
description: How to build/test biohacker-score's native Android/iOS wrapper (Capacitor) — sync steps, native-bridge.js, Codemagic. Use when doing anything native-build-related in this repo, not for day-to-day index.html edits.
---

# Native app wrapper (Capacitor)

As of the Capacitor migration, this repo is *also* an npm project (`package.json`) wrapping `index.html` for iOS/Android distribution via [Capacitor](https://capacitorjs.com). This is additive — it does not change how you edit `index.html` day to day:

- `capacitor.config.json` — `appId: com.biohackerlatino.app`, `webDir: www`
- `www/` — **generated**, a copy of `index.html` + the built `native-bridge.js`. Never hand-edit files in here; they get overwritten.
- `android/` — the native Android project (tracked; this is where `AndroidManifest.xml` permissions etc. live). `ios/` is also tracked (generated via a Codemagic `ios-setup` workflow, `cap add ios`, merged into `main`).
- `src/native-bridge.js` — source for the *only* bundled JS in this repo. Capacitor plugins (like `capacitor-health`) are npm packages that call `registerPlugin()` from `@capacitor/core`, which needs a real module bundler to run — that's what this file is for. It's bundled with esbuild into `native-bridge.js` (iife, no module system) and loaded via a plain `<script>` tag in `index.html`, so the main app script is completely unaffected and stays plain globals (`window.CapacitorHealth`), same as it already does with `window.Capacitor` (auto-injected by the native shell).
- **After editing `index.html`, run `npm run sync`** before testing a native build — it copies `index.html` → `www/`, rebuilds `native-bridge.js`, and runs `npx cap sync` to push both into `android/` and `ios/`. Skip this if you're just testing in a plain browser.
- `isNativeApp` (defined near the top of `index.html`'s script) is `true` only inside the native app shell (`window.Capacitor.isNativePlatform()`), `false`/undefined in a plain browser. Gate any native-only UI (health sync, etc.) behind it — the same pattern already used for `isPremium &&`.
- Building the native Android app requires Android Studio (JDK + Android SDK) locally — not installed in every dev environment; a `codemagic.yaml` `android-debug` workflow builds a debug APK automatically on every push to `main`, so a local Android Studio isn't required just to get a testable build. iOS requires a Mac or a CI service; this project uses **Codemagic** (free tier: 500 macOS build-minutes/month) since Mario develops on Windows — there is currently a workflow that scaffolds the Xcode project (`ios-setup`) but no build/sign workflow yet.

## Testing inside the native wrapper

`npm run sync`, then `npx cap open android` (opens Android Studio) or `npx cap run android` if a device/emulator is already set up.
