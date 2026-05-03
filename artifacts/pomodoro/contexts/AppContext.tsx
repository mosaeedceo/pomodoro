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
import { AppState, Platform, Vibration } from "react-native";

import type { AccentName, ThemeName } from "@/constants/colors";

export type SessionType = "work" | "shortBreak" | "longBreak";

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
  themeName: ThemeName;
  accentName: AccentName;
}

const DEFAULT_SETTINGS: Settings = {
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
  themeName: "crimson",
  accentName: "default",
};

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

interface AppContextValue {
  settings: Settings;
  setSettings: (updater: Partial<Settings>) => void;
  timer: TimerState;
  remainingMs: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
  skip: () => void;
  setTaskLabel: (label: string) => void;
  stats: SessionRecord[];
  clearStats: () => void;
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

function makeId(): string {
  return Date.now().toString() + Math.random().toString(36).slice(2, 9);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowAlert: true,
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
          name: "Pomodoro Timer Pill",
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
          name: "Session Alerts",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          enableVibrate: true,
        },
      );
    }
  } catch {
    // ignore — permissions denied or not available
  }
}

const PILL_NOTIFICATION_ID = "pomodoro-pill-active";

const sessionLabel = (type: SessionType): string => {
  switch (type) {
    case "work":
      return "Focus";
    case "shortBreak":
      return "Short Break";
    case "longBreak":
      return "Long Break";
  }
};

async function showPillNotification(
  type: SessionType,
  remainingMs: number,
  taskLabel: string,
) {
  if (Platform.OS === "web") return;
  try {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const time = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
    const title = `${sessionLabel(type)} • ${time}`;
    const body = taskLabel ? taskLabel : "Pomodoro running";
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

async function showSessionEndNotification(nextType: SessionType) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time's up",
        body: `Next: ${sessionLabel(nextType)}`,
        sound: true,
        ...(Platform.OS === "android"
          ? { channelId: NOTIFICATION_END_CHANNEL_ID }
          : {}),
      },
      trigger: null,
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
          setTimer((prev) => ({ ...prev, ...parsed }));
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
    if (!timer.isRunning) {
      return timer.pausedRemainingMs ?? timer.totalMs;
    }
    if (timer.startedAt == null) return timer.totalMs;
    const elapsed = now - timer.startedAt;
    return Math.max(0, timer.totalMs - elapsed);
  }, [timer, now]);

  const completeSession = useCallback(() => {
    const current = timerRef.current;
    const s = settingsRef.current;
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

    if (s.vibrationEnabled && Platform.OS !== "web") {
      Vibration.vibrate([0, 250, 250, 250]);
    }
    if (s.soundEnabled) {
      showSessionEndNotification(next);
    }

    setTimer({
      sessionType: next,
      isRunning: shouldAutoStart,
      startedAt: shouldAutoStart ? Date.now() : null,
      pausedRemainingMs: shouldAutoStart ? null : nextTotal,
      totalMs: nextTotal,
      completedRounds: newCompletedRounds,
      taskLabel: current.taskLabel,
    });

    if (!shouldAutoStart) {
      dismissPillNotification();
    }
  }, []);

  // Auto-complete when remaining hits 0
  useEffect(() => {
    if (timer.isRunning && remainingMs <= 0) {
      completeSession();
    }
  }, [remainingMs, timer.isRunning, completeSession]);

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

  // Pill notification updater
  useEffect(() => {
    if (!loaded) return;
    if (Platform.OS === "web") return;
    if (!settings.pillNotificationEnabled) {
      dismissPillNotification();
      return;
    }
    if (!timer.isRunning) {
      dismissPillNotification();
      return;
    }
    showPillNotification(timer.sessionType, remainingMs, timer.taskLabel);
  }, [
    timer.isRunning,
    timer.sessionType,
    timer.taskLabel,
    Math.ceil(remainingMs / 1000),
    settings.pillNotificationEnabled,
    loaded,
  ]);

  const setSettings = useCallback((updates: Partial<Settings>) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, ...updates };
      // If duration for current session changed and timer is not running, sync totalMs
      const currentTimer = timerRef.current;
      if (!currentTimer.isRunning) {
        const newTotal = durationForType(currentTimer.sessionType, newSettings);
        setTimer((t) => ({
          ...t,
          totalMs: newTotal,
          pausedRemainingMs: newTotal,
        }));
      }
      return newSettings;
    });
  }, []);

  const start = useCallback(() => {
    setTimer((prev) => {
      if (prev.isRunning) return prev;
      const remaining = prev.pausedRemainingMs ?? prev.totalMs;
      return {
        ...prev,
        isRunning: true,
        startedAt: Date.now() - (prev.totalMs - remaining),
        pausedRemainingMs: null,
      };
    });
  }, []);

  const pause = useCallback(() => {
    setTimer((prev) => {
      if (!prev.isRunning || prev.startedAt == null) return prev;
      const elapsed = Date.now() - prev.startedAt;
      const remaining = Math.max(0, prev.totalMs - elapsed);
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
        pausedRemainingMs: total,
        totalMs: total,
      };
    });
    dismissPillNotification();
  }, []);

  const skip = useCallback(() => {
    setTimer((prev) => {
      const s = settingsRef.current;
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
    dismissPillNotification();
  }, []);

  const setTaskLabel = useCallback((label: string) => {
    setTimer((prev) => ({ ...prev, taskLabel: label }));
  }, []);

  const clearStats = useCallback(() => {
    setStats([]);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      setSettings,
      timer,
      remainingMs,
      start,
      pause,
      reset,
      skip,
      setTaskLabel,
      stats,
      clearStats,
      loaded,
    }),
    [
      settings,
      setSettings,
      timer,
      remainingMs,
      start,
      pause,
      reset,
      skip,
      setTaskLabel,
      stats,
      clearStats,
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
