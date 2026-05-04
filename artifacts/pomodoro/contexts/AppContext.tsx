import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  I18nManager,
  Platform,
  Share,
  Vibration,
} from "react-native";

import type { AccentName, ThemeName } from "@/constants/colors";
import { playAlarmSound } from "@/lib/alarmPlayer";
import { DEFAULT_ALARM_SOUND, type AlarmSoundName } from "@/lib/alarmSounds";
import {
  createTranslator,
  isRtlLanguage,
  type LanguageCode,
} from "@/lib/i18n";
import { FloatingPill } from "floating-pill";

export type SessionType = "work" | "shortBreak" | "longBreak";
export type TimerMode = "pomodoro" | "stopwatch";

export interface Settings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  roundsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  tickEnabled: boolean;
  pillNotificationEnabled: boolean;
  floatingOverlayEnabled: boolean;
  alarmSound: AlarmSoundName;
  alarmVolume: number;
  themeName: ThemeName;
  colorScheme: "system" | "light" | "dark";
  accentName: AccentName;
  language: LanguageCode;
  pillShape: FloatingPillShape;
  timerMode: TimerMode;
  dailyGoal: number;
  quietHoursEnabled: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartWork: false,
  soundEnabled: true,
  vibrationEnabled: true,
  tickEnabled: false,
  pillNotificationEnabled: true,
  floatingOverlayEnabled: false,
  alarmSound: DEFAULT_ALARM_SOUND,
  alarmVolume: 0.8,
  themeName: "crimson",
  colorScheme: "system",
  accentName: "default",
  language: "en",
  pillShape: "classic",
  timerMode: "pomodoro",
  dailyGoal: 6,
  quietHoursEnabled: false,
  quietHoursStart: 22 * 60,
  quietHoursEnd: 7 * 60,
  onboardingCompleted: false,
};

export const PRESETS: { name: string; settings: Partial<Settings> }[] = [
  {
    name: "Classic 25/5/15",
    settings: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, roundsBeforeLongBreak: 4 },
  },
  {
    name: "Long focus 50/10/30",
    settings: { workMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 30, roundsBeforeLongBreak: 3 },
  },
  {
    name: "Sprint 15/3/15",
    settings: { workMinutes: 15, shortBreakMinutes: 3, longBreakMinutes: 15, roundsBeforeLongBreak: 4 },
  },
];

export interface SessionRecord {
  id: string;
  type: SessionType;
  durationMs: number;
  completedAt: number;
  taskLabel: string;
}

export interface TimerState {
  sessionType: SessionType;
  isRunning: boolean;
  startedAt: number | null;
  pausedRemainingMs: number | null;
  totalMs: number;
  completedRounds: number;
  taskLabel: string;
}

const STORAGE_KEYS = {
  settings: "@pomodoro/settings/v1",
  timer: "@pomodoro/timer/v1",
  stats: "@pomodoro/stats/v1",
};

const NOTIFICATION_CHANNEL_ID = "pomodoro-pill";
const NOTIFICATION_END_CHANNEL_ID = "pomodoro-alerts";
const NOTIFICATION_END_QUIET_CHANNEL_ID = "pomodoro-alerts-quiet";
const PILL_NOTIFICATION_ID = "pomodoro-pill-active";
const SCHEDULED_END_ID = "pomodoro-end-scheduled";

export type FloatingPillShape = "classic" | "rounded" | "square" | "compact";

interface AppContextValue {
  settings: Settings;
  setSettings: (updater: Partial<Settings>) => void;
  resetSettings: () => void;
  applyPreset: (preset: Partial<Settings>) => void;
  timer: TimerState;
  remainingMs: number;
  elapsedMs: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setTaskLabel: (label: string) => void;
  stats: SessionRecord[];
  clearStats: () => void;
  clearTodayStats: () => void;
  exportStats: () => Promise<void>;
  loaded: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

function durationForType(type: SessionType, settings: Settings): number {
  switch (type) {
    case "work":
      return settings.workMinutes * 60 * 1000;
    case "shortBreak":
      return settings.shortBreakMinutes * 60 * 1000;
    case "longBreak":
      return settings.longBreakMinutes * 60 * 1000;
  }
}

function nextSessionType(
  current: SessionType,
  completedRounds: number,
  settings: Settings,
): SessionType {
  if (current === "work") {
    const nextRoundCount = completedRounds + 1;
    return nextRoundCount % settings.roundsBeforeLongBreak === 0
      ? "longBreak"
      : "shortBreak";
  }
  return "work";
}

function isStopwatchMode(settings: Settings): boolean {
  return settings.timerMode === "stopwatch";
}

function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

function isInQuietHours(settings: Settings, now = new Date()): boolean {
  if (!settings.quietHoursEnabled) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { quietHoursStart: a, quietHoursEnd: b } = settings;
  if (a === b) return false;
  // crossing midnight if a > b
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let notificationsConfigured = false;
async function configureNotifications() {
  if (notificationsConfigured || Platform.OS === "web") return;
  notificationsConfigured = true;
  try {
    await Notifications.requestPermissionsAsync();
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(
        NOTIFICATION_CHANNEL_ID,
        {
          name: "Pomodoro",
          importance: Notifications.AndroidImportance.LOW,
          vibrationPattern: [0],
          enableVibrate: false,
          showBadge: false,
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        },
      );
      await Notifications.setNotificationChannelAsync(
        NOTIFICATION_END_CHANNEL_ID,
        {
          name: "Pomodoro Alerts",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
        },
      );
      await Notifications.setNotificationChannelAsync(
        NOTIFICATION_END_QUIET_CHANNEL_ID,
        {
          name: "Pomodoro Alerts (quiet)",
          importance: Notifications.AndroidImportance.LOW,
          vibrationPattern: [0],
          enableVibrate: false,
          sound: null,
        },
      );
    }
  } catch {
    // ignore — permissions denied or not available
  }
}

export const sessionLabel = (
  type: SessionType,
  language: LanguageCode = "en",
): string => {
  const t = createTranslator(language);
  switch (type) {
    case "work":
      return t("session.work");
    case "shortBreak":
      return t("session.shortBreak");
    case "longBreak":
      return t("session.longBreak");
  }
};

async function showPillNotification(
  type: SessionType,
  displayMs: number,
  taskLabel: string,
  language: LanguageCode,
) {
  if (Platform.OS === "web") return;
  try {
    const totalSeconds = Math.max(0, Math.ceil(displayMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const time = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
    const label = sessionLabel(type, language);
    const t = createTranslator(language);
    const title = `${label} • ${time}`;
    const body = taskLabel ? taskLabel : t("notification.remaining", { time });
    await Notifications.scheduleNotificationAsync({
      identifier: PILL_NOTIFICATION_ID,
      content: {
        title,
        body,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        ...(Platform.OS === "android"
          ? {
              channelId: NOTIFICATION_CHANNEL_ID,
              color: "#c8442a",
            }
          : {}),
      },
      trigger: null,
    });
  } catch {
    // ignore
  }
}

async function dismissPillNotification() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.dismissNotificationAsync(PILL_NOTIFICATION_ID);
  } catch {
    // ignore
  }
}

async function cancelScheduledEnd() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(SCHEDULED_END_ID);
  } catch {
    // ignore
  }
}

async function scheduleEndNotification(
  currentType: SessionType,
  completedRounds: number,
  endAt: number,
  settings: Settings,
) {
  if (Platform.OS === "web") return;
  await cancelScheduledEnd();
  if (!settings.soundEnabled && !settings.vibrationEnabled) return;
  const seconds = Math.max(1, Math.round((endAt - Date.now()) / 1000));
  const willEndDate = new Date(endAt);
  const inQuiet = isInQuietHours(settings, willEndDate);
  const shouldSound = settings.soundEnabled && !inQuiet;
  const next = nextSessionType(currentType, completedRounds, settings);
  const t = createTranslator(settings.language);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: SCHEDULED_END_ID,
      content: {
        title: t("notification.timeUp"),
        body: t("notification.next", {
          label: sessionLabel(next, settings.language),
        }),
        sound: shouldSound,
        // During quiet hours, route to a silent/no-vibrate channel so the OS
        // delivers the alert without sound or vibration even when the JS
        // bridge is paused.
        ...(Platform.OS === "android"
          ? {
              channelId: inQuiet
                ? NOTIFICATION_END_QUIET_CHANNEL_ID
                : NOTIFICATION_END_CHANNEL_ID,
            }
          : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  } catch {
    // ignore
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [timer, setTimer] = useState<TimerState>({
    sessionType: "work",
    isRunning: false,
    startedAt: null,
    pausedRemainingMs: null,
    totalMs: DEFAULT_SETTINGS.workMinutes * 60 * 1000,
    completedRounds: 0,
    taskLabel: "",
  });
  const [stats, setStats] = useState<SessionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<number>(Date.now());

  const settingsRef = useRef(settings);
  const timerRef = useRef(timer);
  settingsRef.current = settings;
  timerRef.current = timer;

  // Load persisted state
  useEffect(() => {
    (async () => {
      try {
        const [s, t, st] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.settings),
          AsyncStorage.getItem(STORAGE_KEYS.timer),
          AsyncStorage.getItem(STORAGE_KEYS.stats),
        ]);
        if (s) {
          const parsed = JSON.parse(s);
          setSettingsState({ ...DEFAULT_SETTINGS, ...parsed });
        }
        if (t) {
          const parsed = JSON.parse(t);
          setTimer((prev) => ({ ...prev, ...parsed, isRunning: false, startedAt: null }));
        }
        if (st) {
          setStats(JSON.parse(st));
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
    configureNotifications();
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    const rtl = isRtlLanguage(settings.language);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
    AsyncStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings)).catch(
      () => {},
    );
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.timer, JSON.stringify(timer)).catch(
      () => {},
    );
  }, [timer, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats)).catch(
      () => {},
    );
  }, [stats, loaded]);

  // Tick loop
  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timer.isRunning]);

  // Refresh on app state change
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => sub.remove();
  }, []);

  const remainingMs = useMemo(() => {
    if (isStopwatchMode(settings)) return 0;
    if (!timer.isRunning) {
      return timer.pausedRemainingMs ?? timer.totalMs;
    }
    if (timer.startedAt == null) return timer.totalMs;
    const elapsed = now - timer.startedAt;
    return Math.max(0, timer.totalMs - elapsed);
  }, [settings.timerMode, timer, now]);

  const elapsedMs = useMemo(() => {
    if (isStopwatchMode(settings)) {
      if (!timer.isRunning) return timer.pausedRemainingMs ?? 0;
      if (timer.startedAt == null) return timer.pausedRemainingMs ?? 0;
      return Math.max(0, timer.pausedRemainingMs ?? 0) + Math.max(0, now - timer.startedAt);
    }
    return Math.max(0, timer.totalMs - remainingMs);
  }, [settings.timerMode, timer, now, remainingMs]);

  const completeSession = useCallback(() => {
    const current = timerRef.current;
    const s = settingsRef.current;
    if (isStopwatchMode(s)) return;
    const completedAt = Date.now();
    const record: SessionRecord = {
      id: makeId(),
      type: current.sessionType,
      durationMs: current.totalMs,
      completedAt,
      taskLabel: current.taskLabel,
    };
    setStats((prev) => [record, ...prev].slice(0, 500));

    const newCompletedRounds =
      current.sessionType === "work"
        ? current.completedRounds + 1
        : current.completedRounds;
    const next = nextSessionType(
      current.sessionType,
      current.completedRounds,
      s,
    );
    const nextTotal = durationForType(next, s);
    const shouldAutoStart =
      (current.sessionType === "work" && s.autoStartBreaks) ||
      (current.sessionType !== "work" && s.autoStartWork);

    const inQuiet = isInQuietHours(s);
    if (s.vibrationEnabled && Platform.OS !== "web" && !inQuiet) {
      Vibration.vibrate([0, 250, 250, 250]);
    }
    // The scheduled local notification fires the sound/banner reliably when
    // the JS bridge is paused. Cancel it in case auto-complete fired before
    // the OS trigger so we don't double up.
    cancelScheduledEnd();
    if (s.soundEnabled && !inQuiet) {
      playAlarmSound(s.alarmSound, s.alarmVolume);
    }

    const startedAt = shouldAutoStart ? Date.now() : null;
    setTimer({
      sessionType: next,
      isRunning: shouldAutoStart,
      startedAt,
      pausedRemainingMs: shouldAutoStart ? null : nextTotal,
      totalMs: nextTotal,
      completedRounds: newCompletedRounds,
      taskLabel: current.taskLabel,
    });

    if (shouldAutoStart && startedAt != null) {
      scheduleEndNotification(
        next,
        newCompletedRounds,
        startedAt + nextTotal,
        s,
      );
    } else {
      dismissPillNotification();
    }
  }, []);

  // Auto-complete when remaining hits 0
  useEffect(() => {
    if (!isStopwatchMode(settings) && timer.isRunning && remainingMs <= 0) {
      completeSession();
    }
  }, [settings, remainingMs, timer.isRunning, completeSession]);

  // Tick haptic — plays once per second while running
  const lastTickSecondRef = useRef<number>(-1);
  useEffect(() => {
    if (!timer.isRunning) {
      lastTickSecondRef.current = -1;
      return;
    }
    if (!settings.tickEnabled) return;
    if (Platform.OS === "web") return;
    const seconds = Math.ceil(remainingMs / 1000);
    if (seconds === lastTickSecondRef.current) return;
    if (seconds <= 0) return;
    lastTickSecondRef.current = seconds;
    Haptics.selectionAsync().catch(() => {});
  }, [remainingMs, timer.isRunning, settings.tickEnabled]);

  // Floating overlay (system-wide, Android-only, custom dev build only).
  const lastOverlayShownRef = useRef(false);
  const overlayPermissionRef = useRef<boolean | null>(null);
  const lastOverlayStateKeyRef = useRef("");

  // Cross-build migration: if `floatingOverlayEnabled` was persisted by
  // a prior custom build but the app now runs somewhere the native
  // module is unavailable (Expo Go, iOS), flip back to the sticky
  // notification so the live countdown keeps working.
  useEffect(() => {
    if (!loaded) return;
    if (settingsRef.current.floatingOverlayEnabled && !FloatingPill.isAvailable()) {
      setSettingsState((prev) => ({
        ...prev,
        floatingOverlayEnabled: false,
        pillNotificationEnabled: true,
      }));
    }
  }, [loaded]);

  // Re-check overlay permission on app resume so revocations take effect.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!FloatingPill.isAvailable()) return;
    const check = () => {
      FloatingPill.hasOverlayPermission().then((g: boolean) => {
        overlayPermissionRef.current = g;
        // Guaranteed fallback: if the user had picked "floating overlay"
        // but permission is now denied/revoked, flip the live-countdown
        // selection back to the sticky notification so they're never
        // left without a live countdown.
        if (!g && settingsRef.current.floatingOverlayEnabled) {
          setSettingsState((prev) => ({
            ...prev,
            floatingOverlayEnabled: false,
            pillNotificationEnabled: true,
          }));
        }
      });
    };
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (Platform.OS !== "android") return;
    if (!FloatingPill.isAvailable()) return;
    // If permission has been revoked, don't keep starting the service.
    if (overlayPermissionRef.current === false) {
      if (lastOverlayShownRef.current) {
        FloatingPill.hide();
        lastOverlayShownRef.current = false;
        lastOverlayStateKeyRef.current = "";
      }
      return;
    }

    // Show whenever the overlay is enabled AND a session is in progress —
    // running OR paused mid-session. This way the user can resume the
    // session by tapping the play icon on the overlay itself.
    const sessionInProgress =
      timer.isRunning ||
      (isStopwatchMode(settings)
        ? (timer.pausedRemainingMs ?? 0) > 0
        : timer.pausedRemainingMs != null &&
          timer.pausedRemainingMs > 0 &&
          timer.pausedRemainingMs < timer.totalMs);
    const enabled = settings.floatingOverlayEnabled && sessionInProgress;
    const sessionColor =
      timer.sessionType === "work"
        ? "#c8442a"
        : timer.sessionType === "shortBreak"
          ? "#2a9d8f"
          : "#6b78c8";
    const displayMs = isStopwatchMode(settings) ? elapsedMs : remainingMs;
    const totalSeconds = Math.max(
      0,
      isStopwatchMode(settings)
        ? Math.floor(displayMs / 1000)
        : Math.ceil(displayMs / 1000),
    );
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const time = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
    const label = sessionLabel(timer.sessionType, settings.language);
    const endAt =
      timer.isRunning && !isStopwatchMode(settings) && timer.startedAt != null
        ? timer.startedAt + timer.totalMs
        : Date.now() + remainingMs;
    const displayStartedAt =
      timer.isRunning && timer.startedAt != null
        ? timer.startedAt
        : Date.now() - displayMs;
    const overlayElapsedMs = isStopwatchMode(settings) && timer.isRunning ? 0 : displayMs;

    if (!enabled) {
      if (lastOverlayShownRef.current) {
        FloatingPill.hide();
        lastOverlayShownRef.current = false;
        lastOverlayStateKeyRef.current = "";
      }
      return;
    }

    const state = {
      label,
      time,
      task: timer.taskLabel,
      running: timer.isRunning,
      color: sessionColor,
      endAt,
      totalMs: timer.totalMs,
      shape: settings.pillShape,
      mode: settings.timerMode,
      startedAt: displayStartedAt,
      elapsedMs: overlayElapsedMs,
    };
    const overlayStateKey = [
      label,
      time,
      timer.taskLabel,
      timer.isRunning,
      sessionColor,
      Math.floor(endAt / 1000),
      settings.pillShape,
      settings.timerMode,
      Math.floor(displayStartedAt / 1000),
      Math.floor(overlayElapsedMs / 1000),
    ].join("|");
    if (
      lastOverlayShownRef.current &&
      overlayStateKey === lastOverlayStateKeyRef.current
    ) {
      return;
    }
    if (!lastOverlayShownRef.current) {
      FloatingPill.show(state);
      lastOverlayShownRef.current = true;
    } else {
      FloatingPill.update(state);
    }
    lastOverlayStateKeyRef.current = overlayStateKey;
  }, [
    loaded,
    settings.floatingOverlayEnabled,
    settings.timerMode,
    timer.isRunning,
    timer.pausedRemainingMs,
    timer.totalMs,
    timer.sessionType,
    timer.taskLabel,
    settings.language,
    settings.pillShape,
    remainingMs,
    elapsedMs,
  ]);

  // Wire overlay toggle/open events back to timer actions
  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (!FloatingPill.isAvailable()) return;
    const toggleSub = FloatingPill.addListener("onToggle", () => {
      const current = timerRef.current;
      if (current.isRunning) {
        // call current pause via state update
        setTimer((prev) => {
          if (!prev.isRunning || prev.startedAt == null) return prev;
          const elapsed = Date.now() - prev.startedAt;
          const value = isStopwatchMode(settingsRef.current)
            ? Math.max(0, prev.pausedRemainingMs ?? 0) + Math.max(0, elapsed)
            : Math.max(0, prev.totalMs - elapsed);
          cancelScheduledEnd();
          return {
            ...prev,
            isRunning: false,
            startedAt: null,
            pausedRemainingMs: value,
          };
        });
      } else {
        setTimer((prev) => {
          if (prev.isRunning) return prev;
          if (isStopwatchMode(settingsRef.current)) {
            return {
              ...prev,
              isRunning: true,
              startedAt: Date.now(),
            };
          }
          const remaining = prev.pausedRemainingMs ?? prev.totalMs;
          const startedAt = Date.now() - (prev.totalMs - remaining);
          scheduleEndNotification(
            prev.sessionType,
            prev.completedRounds,
            startedAt + prev.totalMs,
            settingsRef.current,
          );
          return {
            ...prev,
            isRunning: true,
            startedAt,
            pausedRemainingMs: null,
          };
        });
      }
    });
    const openSub = FloatingPill.addListener("onOpen", () => {
      // Native side already brings the launcher activity forward; nothing
      // else needed here.
    });
    return () => {
      toggleSub.remove();
      openSub.remove();
    };
  }, []);

  // Pill notification updater — throttled to once per minute change to avoid notification flicker
  const lastPillMinuteRef = useRef<number>(-1);
  const pillDisplayMs = isStopwatchMode(settings) ? elapsedMs : remainingMs;
  const pillSeconds = isStopwatchMode(settings)
    ? Math.floor(pillDisplayMs / 1000)
    : Math.ceil(pillDisplayMs / 1000);
  const pillMinute = Math.ceil(pillSeconds / 60);
  useEffect(() => {
    if (!loaded) return;
    if (Platform.OS === "web") return;
    if (!settings.pillNotificationEnabled) {
      dismissPillNotification();
      lastPillMinuteRef.current = -1;
      return;
    }
    if (!timer.isRunning) {
      dismissPillNotification();
      lastPillMinuteRef.current = -1;
      return;
    }
    if (lastPillMinuteRef.current === pillMinute) return;
    lastPillMinuteRef.current = pillMinute;
    showPillNotification(
      timer.sessionType,
      pillDisplayMs,
      timer.taskLabel,
      settings.language,
    );
  }, [
    timer.isRunning,
    timer.sessionType,
    timer.taskLabel,
    pillMinute,
    pillDisplayMs,
    settings.pillNotificationEnabled,
    settings.language,
    settings.timerMode,
    loaded,
  ]);

  const setSettings = useCallback((updates: Partial<Settings>) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, ...updates };
      // Mutual exclusion: the live countdown can be off, sticky, or
      // floating overlay — never both. Whichever toggle was just turned
      // ON wins; the other is forced OFF.
      if (
        updates.floatingOverlayEnabled === true &&
        updates.pillNotificationEnabled === undefined
      ) {
        newSettings.pillNotificationEnabled = false;
      }
      if (
        updates.pillNotificationEnabled === true &&
        updates.floatingOverlayEnabled === undefined
      ) {
        newSettings.floatingOverlayEnabled = false;
      }
      // Only resync totalMs if the timer is in a fully reset state (not paused mid-session).
      // If pausedRemainingMs equals totalMs, the timer is fresh — safe to resync.
      const currentTimer = timerRef.current;
      if (
        updates.timerMode != null &&
        updates.timerMode !== prev.timerMode &&
        !currentTimer.isRunning
      ) {
        const newTotal = durationForType(currentTimer.sessionType, newSettings);
        setTimer((t) => ({
          ...t,
          isRunning: false,
          startedAt: null,
          pausedRemainingMs: updates.timerMode === "stopwatch" ? 0 : newTotal,
          totalMs: newTotal,
        }));
        return newSettings;
      }
      const isFreshlyReset =
        !currentTimer.isRunning &&
        (currentTimer.pausedRemainingMs == null ||
          currentTimer.pausedRemainingMs === currentTimer.totalMs);
      if (isFreshlyReset) {
        const newTotal = durationForType(currentTimer.sessionType, newSettings);
        if (newTotal !== currentTimer.totalMs) {
          setTimer((t) => ({
            ...t,
            totalMs: newTotal,
            pausedRemainingMs: newTotal,
          }));
        }
      }
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState((prev) => {
      const next: Settings = {
        ...DEFAULT_SETTINGS,
        onboardingCompleted: prev.onboardingCompleted,
      };
      // Resync timer to default durations if the timer is fresh (not running,
      // not paused mid-session). If running/paused, preserve user progress —
      // they can manually reset the timer.
      const currentTimer = timerRef.current;
      const isFreshlyReset =
        !currentTimer.isRunning &&
        (currentTimer.pausedRemainingMs == null ||
          currentTimer.pausedRemainingMs === currentTimer.totalMs);
      if (isFreshlyReset) {
        const newTotal = durationForType(currentTimer.sessionType, next);
        if (newTotal !== currentTimer.totalMs) {
          setTimer((t) => ({
            ...t,
            totalMs: newTotal,
            pausedRemainingMs: newTotal,
          }));
        }
      }
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset: Partial<Settings>) => {
    setSettings(preset);
  }, [setSettings]);

  const start = useCallback(() => {
    setTimer((prev) => {
      if (prev.isRunning) return prev;
      if (isStopwatchMode(settingsRef.current)) {
        return {
          ...prev,
          isRunning: true,
          startedAt: Date.now(),
        };
      }
      const remaining = prev.pausedRemainingMs ?? prev.totalMs;
      const startedAt = Date.now() - (prev.totalMs - remaining);
      scheduleEndNotification(
        prev.sessionType,
        prev.completedRounds,
        startedAt + prev.totalMs,
        settingsRef.current,
      );
      return {
        ...prev,
        isRunning: true,
        startedAt,
        pausedRemainingMs: null,
      };
    });
  }, []);

  const pause = useCallback(() => {
    setTimer((prev) => {
      if (!prev.isRunning || prev.startedAt == null) return prev;
      const elapsed = Date.now() - prev.startedAt;
      const remaining = isStopwatchMode(settingsRef.current)
        ? Math.max(0, prev.pausedRemainingMs ?? 0) + Math.max(0, elapsed)
        : Math.max(0, prev.totalMs - elapsed);
      cancelScheduledEnd();
      return {
        ...prev,
        isRunning: false,
        startedAt: null,
        pausedRemainingMs: remaining,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setTimer((prev) => {
      const total = durationForType(prev.sessionType, settingsRef.current);
      return {
        ...prev,
        isRunning: false,
        startedAt: null,
        pausedRemainingMs: isStopwatchMode(settingsRef.current) ? 0 : total,
        totalMs: total,
      };
    });
    cancelScheduledEnd();
    dismissPillNotification();
  }, []);

  const skip = useCallback(() => {
    setTimer((prev) => {
      const s = settingsRef.current;
      if (isStopwatchMode(s)) {
        return {
          ...prev,
          isRunning: false,
          startedAt: null,
          pausedRemainingMs: 0,
        };
      }
      const newCompletedRounds =
        prev.sessionType === "work"
          ? prev.completedRounds + 1
          : prev.completedRounds;
      const next = nextSessionType(prev.sessionType, prev.completedRounds, s);
      const nextTotal = durationForType(next, s);
      return {
        ...prev,
        sessionType: next,
        isRunning: false,
        startedAt: null,
        pausedRemainingMs: nextTotal,
        totalMs: nextTotal,
        completedRounds: newCompletedRounds,
      };
    });
    cancelScheduledEnd();
    dismissPillNotification();
  }, []);

  const setTaskLabel = useCallback((label: string) => {
    setTimer((prev) => ({ ...prev, taskLabel: label }));
  }, []);

  const clearStats = useCallback(() => {
    setStats([]);
  }, []);

  const clearTodayStats = useCallback(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cutoff = todayStart.getTime();
    setStats((prev) => prev.filter((s) => s.completedAt < cutoff));
  }, []);

  const exportStats = useCallback(async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      sessions: stats,
    };
    const json = JSON.stringify(payload, null, 2);
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        // ignore
      }
      return;
    }
    try {
      await Share.share({
        message: json,
        title: createTranslator(settingsRef.current.language)("settings.exportStats"),
      });
    } catch {
      // ignore
    }
  }, [stats]);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      setSettings,
      resetSettings,
      applyPreset,
      timer,
      remainingMs,
      elapsedMs,
      start,
      pause,
      reset,
      skip,
      setTaskLabel,
      stats,
      clearStats,
      clearTodayStats,
      exportStats,
      loaded,
    }),
    [
      settings,
      setSettings,
      resetSettings,
      applyPreset,
      timer,
      remainingMs,
      elapsedMs,
      start,
      pause,
      reset,
      skip,
      setTaskLabel,
      stats,
      clearStats,
      clearTodayStats,
      exportStats,
      loaded,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function useSettings(): {
  settings: Settings;
  setSettings: (updates: Partial<Settings>) => void;
} {
  const { settings, setSettings } = useApp();
  return { settings, setSettings };
}
