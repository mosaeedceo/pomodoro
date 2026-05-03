# Pomodoro

Frontend-only Expo (React Native) Pomodoro timer artifact at `artifacts/pomodoro` with a custom pop-up pill notification that shows the live countdown while a session is running.

## Architecture

- **Frontend only** — no backend. State persisted via AsyncStorage:
  - `@pomodoro/settings/v1` — user settings
  - `@pomodoro/timer/v1` — timer state (sessionType, isRunning, startedAt, totalMs, completedRounds, taskLabel)
  - `@pomodoro/stats/v1` — completed session history (most-recent first, capped at 500)
- **State**: single `AppProvider` (`contexts/AppContext.tsx`) holds settings, timer, and stats. `useColors()` reads `settings.themeName` and must be inside the provider (wired in `app/_layout.tsx`).
- **Timer**: timestamp-based — when running, `remainingMs = totalMs - (now - startedAt)`. A 250ms tick interval triggers re-renders. Auto-completion fires when `remainingMs <= 0`.
- **Pill notification**: two surfaces.
  1. Android persistent ongoing notification via `expo-notifications` channel `pomodoro-pill` (LOW importance, sticky, autoDismiss false, updated each second with countdown). Closest realistic Android overlay in Expo Go — true `SYSTEM_ALERT_WINDOW` over other apps requires a custom dev build with a native module.
  2. In-app floating pill (`components/PillNotification.tsx`) shown at the bottom of Stats/Settings screens when a timer is running.

## Screens

- `app/(tabs)/index.tsx` — main timer with circular progress, session pill, task label input, controls (reset / play-pause / skip), round dots
- `app/(tabs)/stats.tsx` — today summary, weekly bar chart, all-time totals, recent sessions
- `app/(tabs)/settings.tsx` — duration steppers, behavior toggles (auto-start), alert toggles (pill / sound / vibration), theme grid

## Themes

5 themes in `constants/colors.ts`, each with light + dark palettes: Crimson (default), Deep Ocean, Forest, Midnight, Sunset.

## Key dependencies (added)

- `expo-notifications ~0.32.17` — persistent notification + end-of-session alert
- Pre-existing: expo-blur, expo-linear-gradient, expo-haptics, react-native-svg, AsyncStorage

## app.json

- Plugins: `expo-router`, `expo-font`, `expo-web-browser`, `expo-notifications` (color #c8442a)
- Android permissions: `VIBRATE`, `POST_NOTIFICATIONS`, `WAKE_LOCK`
- iOS background mode: `audio` (for end-of-session alert)
