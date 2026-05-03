# Pomodoro

Frontend-only Expo (React Native) Pomodoro timer artifact at `artifacts/pomodoro` with a custom pop-up pill notification that shows the live countdown while a session is running.

## Architecture

- **Frontend only** — no backend. State persisted via AsyncStorage:
  - `@pomodoro/settings/v1` — user settings
  - `@pomodoro/timer/v1` — timer state (sessionType, isRunning, startedAt, totalMs, completedRounds, taskLabel)
  - `@pomodoro/stats/v1` — completed session history (most-recent first, capped at 500)
- **State**: single `AppProvider` (`contexts/AppContext.tsx`) holds settings, timer, and stats. `useColors()` reads `settings.themeName` and must be inside the provider (wired in `app/_layout.tsx`).
- **Timer**: timestamp-based — when running, `remainingMs = totalMs - (now - startedAt)`. A 250ms tick interval triggers re-renders. Auto-completion fires when `remainingMs <= 0`.
- **End-of-session alert**: scheduled as an OS-level local notification at `start()` (and re-scheduled on resume), cancelled on pause/reset/skip/complete. The notification fires reliably even if the JS bridge is paused (app backgrounded, screen off). Vibration also plays from JS when auto-completion fires while the app is foregrounded.
- **Pill notification**: two surfaces.
  1. Android persistent ongoing notification via `expo-notifications` channel `pomodoro-pill` (LOW importance, sticky, autoDismiss false). Updated only on minute-boundary changes to avoid notification flicker. Closest realistic Android overlay in Expo Go — true `SYSTEM_ALERT_WINDOW` over other apps requires a custom dev build with a native module.
  2. In-app floating pill (`components/PillNotification.tsx`) shown at the bottom of Stats/Settings screens when a timer is running. Tap to switch to the Timer tab; tap the play/pause button to toggle without leaving the current screen.
- **Quiet hours**: optional window (start/end minutes from midnight). When the scheduled end-time falls inside the window, the OS notification is silenced and JS-side vibration is suppressed.
- **Onboarding**: a one-time `Modal` (`components/OnboardingSheet.tsx`) shown on first launch, persisted via `settings.onboardingCompleted`.

## Screens

- `app/(tabs)/index.tsx` — main timer with circular progress, session pill, task label input, controls (reset / play-pause / skip), round dots. Header shows a "today" chip linking to Stats; long-press the session pill to jump to Settings; tap anywhere on the ring to start/pause; ring turns destructive in the last 10 seconds; "Next:" line previews the upcoming session.
- `app/(tabs)/stats.tsx` — Today card with a daily-goal ring, Today/Week/Month/All segmented filter, weekly bar chart (bars highlight days that hit the goal), all-time totals, recent sessions (with per-row Resume button that copies the task label back to the timer), export as JSON, Clear today / Clear all.
- `app/(tabs)/settings.tsx` — quick presets (Classic / Long focus / Sprint), duration steppers, daily goal stepper, behavior toggles (auto-start), alert toggles (pill / sound / vibration / haptic tick), quiet hours (enable + From/To clock), theme grid (swatches reflect the current accent override), accent picker, Data section (Export stats), Reset to defaults in header (with confirmation Alert).

## Themes

5 themes in `constants/colors.ts`, each with light + dark palettes: Crimson (default), Deep Ocean, Forest, Midnight, Sunset. An accent color can override the theme's primary/work color.

## Key dependencies

- `expo-notifications ~0.32.17` — persistent pill notification + scheduled end-of-session alert
- Pre-existing: expo-blur, expo-linear-gradient, expo-haptics, react-native-svg, AsyncStorage, expo-router, react-native-safe-area-context

## app.json

- Plugins: `expo-router`, `expo-font`, `expo-web-browser`, `expo-notifications` (color #c8442a)
- Android permissions: `VIBRATE`, `POST_NOTIFICATIONS`, `WAKE_LOCK`
- iOS background mode: `audio` (for end-of-session alert)

## Going native (true overlay over other apps)

Expo Go cannot grant Android's `SYSTEM_ALERT_WINDOW` permission, so the floating pill outside the app is implemented as a sticky notification. To upgrade to a real overlay (a draggable bubble that stays on top of every other app), the path is:

1. Run `pnpm --filter @workspace/pomodoro exec expo prebuild --platform android` to generate a native `android/` directory.
2. Add `<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />` and `<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />` to `android/app/src/main/AndroidManifest.xml`.
3. Author a small Expo Modules native module (Kotlin) that:
   - Checks/requests the overlay permission via `Settings.canDrawOverlays(context)` and `ACTION_MANAGE_OVERLAY_PERMISSION`.
   - Starts a foreground `Service` that inflates a `View` and adds it to the `WindowManager` with `LayoutParams.TYPE_APPLICATION_OVERLAY` (API 26+).
   - Exposes JS methods `show(remainingMs, sessionType, taskLabel)`, `update(remainingMs)`, and `hide()`.
4. From `AppContext`, call `OverlayModule.show()` on `start()` and `OverlayModule.update()` on each tick (or every minute), `OverlayModule.hide()` on pause/reset/skip/complete.
5. Replace the Expo Go pill notification with the overlay when the permission is granted; fall back to the current sticky notification otherwise.
6. Build with `eas build --profile development --platform android` (or `pnpm --filter @workspace/pomodoro exec expo run:android` locally) to install the custom dev client.
7. Optional: ship the module as a local Expo config plugin so the manifest entries are added automatically on every prebuild.
8. Optional: wire iOS Live Activities (`ActivityKit`) for an equivalent always-visible countdown on the Lock Screen / Dynamic Island.
9. Add a Settings toggle to choose "Sticky notification" vs "Floating overlay".
10. Ship via EAS Submit to the Play Store / TestFlight — the overlay permission triggers an extra Play Console disclosure.
