import { Feather } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  accentList,
  resolveAccent,
  themeList,
  type AccentName,
  type ThemeName,
} from "@/constants/colors";
import { PRESETS, useApp, type SessionType } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatTime } from "@/lib/format";
import { playAlarmSound } from "@/lib/alarmPlayer";
import { ALARM_SOUNDS, type AlarmSoundName } from "@/lib/alarmSounds";
import { FloatingPill } from "floating-pill";

function formatClock(minutesFromMidnight: number): string {
  const m = ((minutesFromMidnight % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:${mm.toString().padStart(2, "0")} ${period}`;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const layout = useResponsiveLayout();
  const {
    settings,
    setSettings,
    resetSettings,
    applyPreset,
    exportStats,
    timer,
    remainingMs,
  } = useApp();

  const previewType: SessionType = timer.sessionType;
  const previewColor =
    previewType === "work"
      ? colors.workColor
      : previewType === "shortBreak"
        ? colors.shortBreakColor
        : colors.longBreakColor;
  const previewLabel =
    previewType === "work"
      ? "Focus"
      : previewType === "shortBreak"
        ? "Short Break"
        : "Long Break";
  const previewTime = timer.isRunning
    ? formatTime(remainingMs)
    : formatTime(
        (previewType === "work"
          ? settings.workMinutes
          : previewType === "shortBreak"
            ? settings.shortBreakMinutes
            : settings.longBreakMinutes) *
          60 *
          1000,
      );

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const confirmReset = () => {
    if (Platform.OS === "web") {
      resetSettings();
      return;
    }
    Alert.alert(
      "Reset to defaults?",
      "Your durations, behavior, alerts, theme, and goal will return to defaults.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: resetSettings },
      ],
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 200,
          maxWidth: layout.maxContentWidth,
          alignSelf: "center",
          width: "100%",
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>
        <Pressable
          onPress={confirmReset}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reset to defaults"
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: colors.muted,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="rotate-ccw" size={14} color={colors.foreground} />
          <Text style={[styles.headerBtnText, { color: colors.foreground }]}>
            Reset
          </Text>
        </Pressable>
      </View>

      {/* Live pill preview */}
      <View
        style={[
          styles.previewWrap,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.previewCaption, { color: colors.mutedForeground }]}>
          Live preview
        </Text>
        <View
          style={[
            styles.previewPill,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.previewDot, { backgroundColor: previewColor }]} />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.previewLabel, { color: colors.mutedForeground }]}
            >
              {previewLabel}
            </Text>
            <Text style={[styles.previewTime, { color: colors.foreground }]}>
              {previewTime}
            </Text>
          </View>
          <View
            style={[styles.previewBtn, { backgroundColor: previewColor }]}
          >
            <Feather
              name={timer.isRunning ? "pause" : "play"}
              size={14}
              color="#ffffff"
            />
          </View>
        </View>
      </View>

      {/* Quick presets */}
      <Section title="Quick presets" colors={colors}>
        <View style={styles.presetCol}>
          {PRESETS.map((p, i) => (
            <Pressable
              key={p.name}
              onPress={() => {
                haptic();
                applyPreset(p.settings);
              }}
              style={({ pressed }) => [
                styles.presetRow,
                {
                  borderTopWidth:
                    i === 0 ? 0 : StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Apply preset ${p.name}`}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.presetName, { color: colors.foreground }]}
                >
                  {p.name}
                </Text>
                <Text
                  style={[
                    styles.presetMeta,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {p.settings.workMinutes}m focus · {p.settings.shortBreakMinutes}m short · {p.settings.longBreakMinutes}m long
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          ))}
        </View>
      </Section>

      {/* Durations */}
      <Section title="Durations" colors={colors}>
        <NumberRow
          label="Focus"
          value={settings.workMinutes}
          unit="min"
          min={1}
          max={120}
          step={1}
          color={colors.workColor}
          onChange={(v) => {
            haptic();
            setSettings({ workMinutes: v });
          }}
          colors={colors}
        />
        <Divider colors={colors} />
        <NumberRow
          label="Short break"
          value={settings.shortBreakMinutes}
          unit="min"
          min={1}
          max={60}
          step={1}
          color={colors.shortBreakColor}
          onChange={(v) => {
            haptic();
            setSettings({ shortBreakMinutes: v });
          }}
          colors={colors}
        />
        <Divider colors={colors} />
        <NumberRow
          label="Long break"
          value={settings.longBreakMinutes}
          unit="min"
          min={1}
          max={60}
          step={1}
          color={colors.longBreakColor}
          onChange={(v) => {
            haptic();
            setSettings({ longBreakMinutes: v });
          }}
          colors={colors}
        />
        <Divider colors={colors} />
        <NumberRow
          label="Rounds before long break"
          value={settings.roundsBeforeLongBreak}
          unit=""
          min={2}
          max={8}
          step={1}
          color={colors.primary}
          onChange={(v) => {
            haptic();
            setSettings({ roundsBeforeLongBreak: v });
          }}
          colors={colors}
        />
      </Section>

      {/* Goal */}
      <Section title="Daily goal" colors={colors}>
        <NumberRow
          label="Pomodoros per day"
          value={settings.dailyGoal}
          unit=""
          min={0}
          max={20}
          step={1}
          color={colors.primary}
          onChange={(v) => {
            haptic();
            setSettings({ dailyGoal: v });
          }}
          colors={colors}
        />
      </Section>

      {/* Behavior */}
      <Section title="Behavior" colors={colors}>
        <ToggleRow
          label="Auto-start breaks"
          description="Automatically start a break when focus ends"
          value={settings.autoStartBreaks}
          onChange={(v) => setSettings({ autoStartBreaks: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label="Auto-start focus"
          description="Automatically start the next focus when a break ends"
          value={settings.autoStartWork}
          onChange={(v) => setSettings({ autoStartWork: v })}
          colors={colors}
        />
      </Section>

      {/* Alerts */}
      <Section title="Alerts" colors={colors}>
        <LiveCountdownRow
          pillEnabled={settings.pillNotificationEnabled}
          overlayEnabled={settings.floatingOverlayEnabled}
          onChange={(mode) => {
            if (mode === "off") {
              setSettings({
                pillNotificationEnabled: false,
                floatingOverlayEnabled: false,
              });
            } else if (mode === "sticky") {
              setSettings({
                pillNotificationEnabled: true,
                floatingOverlayEnabled: false,
              });
            } else {
              setSettings({
                pillNotificationEnabled: false,
                floatingOverlayEnabled: true,
              });
            }
          }}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label="Sound"
          description="Play an alarm sound when a session ends"
          value={settings.soundEnabled}
          onChange={(v) => setSettings({ soundEnabled: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <AlarmSoundRow
          value={settings.alarmSound}
          volume={settings.alarmVolume}
          enabled={settings.soundEnabled}
          onChange={(v) => {
            haptic();
            setSettings({ alarmSound: v });
          }}
          colors={colors}
        />
        <Divider colors={colors} />
        <VolumeRow
          value={settings.alarmVolume}
          enabled={settings.soundEnabled}
          onChange={(v) => setSettings({ alarmVolume: v })}
          onPreview={() =>
            playAlarmSound(settings.alarmSound, settings.alarmVolume)
          }
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label="Vibration"
          description="Vibrate when a session ends"
          value={settings.vibrationEnabled}
          onChange={(v) => setSettings({ vibrationEnabled: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label="Haptic tick"
          description="A subtle haptic pulse every second while a session runs (no sound)"
          value={settings.tickEnabled}
          onChange={(v) => setSettings({ tickEnabled: v })}
          colors={colors}
        />
      </Section>

      {/* Quiet hours */}
      <Section title="Quiet hours" colors={colors}>
        <ToggleRow
          label="Enable quiet hours"
          description="Mute end-of-session sound during the window below (vibration still off)"
          value={settings.quietHoursEnabled}
          onChange={(v) => setSettings({ quietHoursEnabled: v })}
          colors={colors}
        />
        {settings.quietHoursEnabled ? (
          <>
            <Divider colors={colors} />
            <ClockRow
              label="From"
              value={settings.quietHoursStart}
              onChange={(v) => setSettings({ quietHoursStart: v })}
              colors={colors}
            />
            <Divider colors={colors} />
            <ClockRow
              label="To"
              value={settings.quietHoursEnd}
              onChange={(v) => setSettings({ quietHoursEnd: v })}
              colors={colors}
            />
          </>
        ) : null}
      </Section>

      {/* Themes */}
      <Section title="Theme" colors={colors}>
        <View style={styles.themeGrid}>
          {themeList.map((t) => {
            const palette = scheme === "dark" ? t.dark : t.light;
            const accentOverride = resolveAccent(
              settings.accentName,
              scheme === "dark" ? "dark" : "light",
            );
            const effectivePrimary = accentOverride ?? palette.primary;
            const effectiveWork = accentOverride ?? palette.workColor;
            const selected = settings.themeName === t.name;
            return (
              <Pressable
                key={t.name}
                onPress={() => {
                  haptic();
                  setSettings({ themeName: t.name as ThemeName });
                }}
                style={({ pressed }) => [
                  styles.themeCard,
                  {
                    backgroundColor: palette.card,
                    borderColor: selected ? effectivePrimary : colors.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Theme ${t.label}`}
              >
                <View style={styles.themeSwatchRow}>
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: effectiveWork },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: palette.shortBreakColor },
                    ]}
                  />
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: palette.longBreakColor },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.themeLabel,
                    {
                      color: palette.foreground,
                      fontFamily: selected
                        ? "Inter_700Bold"
                        : "Inter_500Medium",
                    },
                  ]}
                >
                  {t.label}
                </Text>
                {selected ? (
                  <View
                    style={[
                      styles.themeCheck,
                      { backgroundColor: effectivePrimary },
                    ]}
                  >
                    <Feather name="check" size={12} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* Accent */}
      <Section title="Accent color" colors={colors}>
        <View style={styles.accentGrid}>
          {accentList.map((a) => {
            const selected = settings.accentName === a.name;
            const swatch =
              a.name === "default"
                ? colors.workColor
                : scheme === "dark"
                  ? a.dark
                  : a.light;
            return (
              <Pressable
                key={a.name}
                onPress={() => {
                  haptic();
                  setSettings({ accentName: a.name as AccentName });
                }}
                style={({ pressed }) => [
                  styles.accentItem,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Accent ${a.label}`}
              >
                <View
                  style={[
                    styles.accentSwatch,
                    {
                      backgroundColor: swatch,
                      borderColor: selected ? colors.foreground : "transparent",
                      borderWidth: selected ? 3 : 0,
                    },
                  ]}
                >
                  {a.name === "default" ? (
                    <Feather name="droplet" size={14} color="#ffffff" />
                  ) : selected ? (
                    <Feather name="check" size={16} color="#ffffff" />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.accentLabel,
                    {
                      color: selected
                        ? colors.foreground
                        : colors.mutedForeground,
                      fontFamily: selected
                        ? "Inter_600SemiBold"
                        : "Inter_500Medium",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      {/* Data */}
      <Section title="Data" colors={colors}>
        <Pressable
          onPress={exportStats}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Export stats"
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              Export stats
            </Text>
            <Text
              style={[styles.rowDescription, { color: colors.mutedForeground }]}
            >
              Save your session history as JSON
            </Text>
          </View>
          <Feather name="share" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Section>

      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        Heads up: the floating overlay uses Android&apos;s &quot;Display over
        other apps&quot; permission and the system overlay window. It is only
        available in a custom build of the app (not in Expo Go) — when
        running in Expo Go the toggle stays disabled.
      </Text>
    </ScrollView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text
        style={[
          styles.sectionTitle,
          { color: colors.mutedForeground },
        ]}
      >
        {title}
      </Text>
      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Divider({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginHorizontal: 16,
      }}
    />
  );
}

function NumberRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  color,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  color: string;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
      </View>
      <View style={styles.stepper}>
        <Pressable
          onPress={dec}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={({ pressed }) => [
            styles.stepBtn,
            {
              backgroundColor: colors.muted,
              opacity: value <= min ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="minus" size={16} color={colors.foreground} />
        </Pressable>
        <View style={styles.stepValueWrap}>
          <Text style={[styles.stepValue, { color }]}>{value}</Text>
          {unit ? (
            <Text style={[styles.stepUnit, { color: colors.mutedForeground }]}>
              {unit}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={inc}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={({ pressed }) => [
            styles.stepBtn,
            {
              backgroundColor: colors.muted,
              opacity: value >= max ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
  );
}

function minutesToDate(minutes: number): Date {
  const m = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

function dateToMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function ClockRow({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [iosOpen, setIosOpen] = React.useState(false);
  const [iosDraft, setIosDraft] = React.useState<Date>(() =>
    minutesToDate(value),
  );

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: minutesToDate(value),
        mode: "time",
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set" && date) {
            onChange(dateToMinutes(date));
          }
        },
      });
    } else if (Platform.OS === "ios") {
      setIosDraft(minutesToDate(value));
      setIosOpen(true);
    } else {
      // Web fallback: prompt for HH:MM
      // eslint-disable-next-line no-alert
      const current = minutesToDate(value);
      const hh = current.getHours().toString().padStart(2, "0");
      const mm = current.getMinutes().toString().padStart(2, "0");
      const input =
        typeof window !== "undefined"
          ? window.prompt(`${label} (HH:MM, 24-hour)`, `${hh}:${mm}`)
          : null;
      if (input) {
        const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
          const h = Math.min(23, Math.max(0, parseInt(match[1], 10)));
          const m = Math.min(59, Math.max(0, parseInt(match[2], 10)));
          onChange(h * 60 + m);
        }
      }
    }
  };

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label} time, ${formatClock(value)}. Tap to change.`}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>
            {label}
          </Text>
        </View>
        <View
          style={[
            styles.clockPill,
            { backgroundColor: colors.muted },
          ]}
        >
          <Text style={[styles.clockPillText, { color: colors.foreground }]}>
            {formatClock(value)}
          </Text>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
        </View>
      </Pressable>
      {Platform.OS === "ios" ? (
        <Modal
          visible={iosOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIosOpen(false)}
        >
          <Pressable
            style={styles.iosPickerBackdrop}
            onPress={() => setIosOpen(false)}
          >
            <Pressable
              style={[
                styles.iosPickerSheet,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {}}
            >
              <View style={styles.iosPickerHeader}>
                <Pressable
                  onPress={() => setIosOpen(false)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text
                    style={[
                      styles.iosPickerAction,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Text
                  style={[
                    styles.iosPickerTitle,
                    { color: colors.foreground },
                  ]}
                >
                  {label}
                </Text>
                <Pressable
                  onPress={() => {
                    onChange(dateToMinutes(iosDraft));
                    setIosOpen(false);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                >
                  <Text
                    style={[styles.iosPickerAction, { color: colors.primary }]}
                  >
                    Done
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="time"
                display="spinner"
                onChange={(_event, date) => {
                  if (date) setIosDraft(date);
                }}
                themeVariant={colors.background === "#000000" ? "dark" : undefined}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  colors,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        {description ? (
          <Text
            style={[
              styles.rowDescription,
              { color: colors.mutedForeground },
            ]}
          >
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.muted, true: colors.primary }}
        thumbColor="#ffffff"
        ios_backgroundColor={colors.muted}
        accessibilityLabel={label}
      />
    </View>
  );
}

type LiveCountdownMode = "off" | "sticky" | "overlay";

function LiveCountdownRow({
  pillEnabled,
  overlayEnabled,
  onChange,
  colors,
}: {
  pillEnabled: boolean;
  overlayEnabled: boolean;
  onChange: (mode: LiveCountdownMode) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const overlayAvailable = React.useMemo(
    () => Platform.OS === "android" && FloatingPill.isAvailable(),
    [],
  );
  const [hasPermission, setHasPermission] = React.useState(false);
  const pendingOverlayRef = React.useRef(false);

  React.useEffect(() => {
    if (!overlayAvailable) return;
    let cancelled = false;
    const recheck = () => {
      FloatingPill.hasOverlayPermission().then((granted: boolean) => {
        if (cancelled) return;
        setHasPermission(granted);
        if (granted && pendingOverlayRef.current) {
          pendingOverlayRef.current = false;
          onChange("overlay");
        }
      });
    };
    recheck();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") recheck();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [overlayAvailable, onChange]);

  const current: LiveCountdownMode = overlayEnabled
    ? "overlay"
    : pillEnabled
      ? "sticky"
      : "off";

  const selectOverlay = async () => {
    if (!overlayAvailable) {
      Alert.alert(
        "Custom build required",
        "The floating overlay needs Android's \"Display over other apps\" permission, which is only available in a custom build of the app — not in Expo Go. The sticky notification will keep showing the live countdown.",
        [{ text: "OK" }],
      );
      onChange("sticky");
      return;
    }
    const granted = await FloatingPill.hasOverlayPermission();
    if (granted) {
      setHasPermission(true);
      onChange("overlay");
      return;
    }
    Alert.alert(
      "Allow display over other apps",
      "Pomodoro needs the \"Display over other apps\" permission so the live timer pill can float above other apps. Tap Open Settings, then enable the permission for Pomodoro and come back. If you cancel, the sticky notification keeps the live countdown visible.",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => onChange("sticky"),
        },
        {
          text: "Open Settings",
          onPress: async () => {
            pendingOverlayRef.current = true;
            // Until granted, fall back to the sticky notification.
            onChange("sticky");
            await FloatingPill.requestOverlayPermission();
          },
        },
      ],
    );
  };

  const handleSelect = (mode: LiveCountdownMode) => {
    if (mode === current) return;
    if (mode === "overlay") {
      selectOverlay();
      return;
    }
    onChange(mode);
  };

  const description =
    current === "overlay"
      ? "A draggable timer pill floats above other apps while a session runs. Tap it to open Pomodoro; tap the icon to play/pause."
      : current === "sticky"
        ? "A sticky notification shows the live countdown while a session is running."
        : "No live countdown shown outside the app.";

  const segments: { value: LiveCountdownMode; label: string; show: boolean }[] = [
    { value: "off", label: "Off", show: true },
    { value: "sticky", label: "Sticky", show: true },
    { value: "overlay", label: "Floating", show: Platform.OS === "android" },
  ];
  const visible = segments.filter((s) => s.show);

  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <View>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          Live countdown
        </Text>
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>
          {description}
        </Text>
        {Platform.OS === "android" && !overlayAvailable ? (
          <Text
            style={[
              styles.rowDescription,
              { color: colors.mutedForeground, marginTop: 4 },
            ]}
          >
            Floating overlay requires a custom dev build and is not available in
            Expo Go.
          </Text>
        ) : null}
      </View>
      <View
        style={[
          liveStyles.segmentWrap,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        {visible.map((seg) => {
          const selected = current === seg.value;
          const disabled =
            seg.value === "overlay" && Platform.OS === "android" &&
            !overlayAvailable;
          return (
            <Pressable
              key={seg.value}
              onPress={() => !disabled && handleSelect(seg.value)}
              accessibilityRole="button"
              accessibilityLabel={`Live countdown: ${seg.label}`}
              accessibilityState={{ selected, disabled }}
              style={({ pressed }) => [
                liveStyles.segment,
                {
                  backgroundColor: selected ? colors.primary : "transparent",
                  opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text
                style={[
                  liveStyles.segmentLabel,
                  {
                    color: selected ? "#ffffff" : colors.foreground,
                    fontFamily: selected
                      ? "Inter_600SemiBold"
                      : "Inter_500Medium",
                  },
                ]}
              >
                {seg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {current === "overlay" && !hasPermission && overlayAvailable ? (
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>
          Waiting for &quot;Display over other apps&quot; permission. Falling
          back to the sticky notification meanwhile.
        </Text>
      ) : null}
    </View>
  );
}

const liveStyles = StyleSheet.create({
  segmentWrap: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    fontSize: 13,
  },
});

function AlarmSoundRow({
  value,
  volume,
  enabled,
  onChange,
  colors,
}: {
  value: AlarmSoundName;
  volume: number;
  enabled: boolean;
  onChange: (v: AlarmSoundName) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text
          style={[
            styles.rowLabel,
            { color: enabled ? colors.foreground : colors.mutedForeground },
          ]}
        >
          Alarm sound
        </Text>
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>
          Tap a sound to select. Tap again to preview.
        </Text>
      </View>
      <View style={alarmStyles.grid}>
        {ALARM_SOUNDS.map((s) => {
          const selected = value === s.name;
          return (
            <Pressable
              key={s.name}
              disabled={!enabled}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.selectionAsync().catch(() => {});
                }
                if (selected) {
                  playAlarmSound(s.name, volume);
                } else {
                  onChange(s.name);
                  playAlarmSound(s.name, volume);
                }
              }}
              style={({ pressed }) => [
                alarmStyles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.muted,
                  opacity: !enabled ? 0.5 : pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather
                name={selected ? "volume-2" : "play"}
                size={12}
                color={selected ? "#ffffff" : colors.foreground}
              />
              <Text
                style={[
                  alarmStyles.chipLabel,
                  {
                    color: selected ? "#ffffff" : colors.foreground,
                    fontFamily: selected
                      ? "Inter_600SemiBold"
                      : "Inter_500Medium",
                  },
                ]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function VolumeRow({
  value,
  enabled,
  onChange,
  onPreview,
  colors,
}: {
  value: number;
  enabled: boolean;
  onChange: (v: number) => void;
  onPreview: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const pct = Math.round(value * 100);
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.rowLabel,
              { color: enabled ? colors.foreground : colors.mutedForeground },
            ]}
          >
            Volume
          </Text>
          <Text
            style={[styles.rowDescription, { color: colors.mutedForeground }]}
          >
            {enabled ? `${pct}%` : "Sound is off"}
          </Text>
        </View>
        <Pressable
          onPress={onPreview}
          disabled={!enabled}
          style={({ pressed }) => [
            alarmStyles.previewBtn,
            {
              backgroundColor: colors.primary,
              opacity: !enabled ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Feather name="play" size={12} color="#ffffff" />
          <Text style={alarmStyles.previewBtnLabel}>Preview</Text>
        </Pressable>
      </View>
      <Slider
        style={{ width: "100%", height: 32 }}
        minimumValue={0}
        maximumValue={1}
        step={0.05}
        value={value}
        disabled={!enabled}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
      />
    </View>
  );
}

const alarmStyles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipLabel: {
    fontSize: 13,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  previewBtnLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  headerBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  rowDescription: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  previewWrap: {
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  previewCaption: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    paddingHorizontal: 4,
  },
  previewPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  previewLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  previewTime: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  previewBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  presetCol: {},
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  presetName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  presetMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepValueWrap: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    minWidth: 56,
    justifyContent: "center",
  },
  stepValue: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  stepUnit: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  clockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  clockPillText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  iosPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  iosPickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 24,
  },
  iosPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iosPickerTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  iosPickerAction: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 12,
  },
  themeCard: {
    width: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 16,
    gap: 10,
  },
  themeSwatchRow: {
    flexDirection: "row",
    gap: 6,
  },
  themeSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  themeLabel: {
    fontSize: 14,
  },
  themeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  accentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    padding: 16,
    justifyContent: "space-between",
  },
  accentItem: {
    alignItems: "center",
    gap: 6,
    width: 56,
  },
  accentSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  accentLabel: {
    fontSize: 11,
  },
  footnote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    paddingHorizontal: 8,
    marginTop: -8,
  },
});
