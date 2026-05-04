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
import {
  PRESETS,
  useApp,
  type FloatingPillShape,
  type SessionType,
} from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatTime } from "@/lib/format";
import { playAlarmSound } from "@/lib/alarmPlayer";
import { ALARM_SOUNDS, type AlarmSoundName } from "@/lib/alarmSounds";
import {
  createTranslator,
  languageOptions,
  type LanguageCode,
} from "@/lib/i18n";
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
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
  const resolvedScheme =
    settings.colorScheme === "system"
      ? scheme === "dark"
        ? "dark"
        : "light"
      : settings.colorScheme;

  const previewType: SessionType = timer.sessionType;
  const previewColor =
    settings.timerMode === "stopwatch"
      ? colors.primary
      : previewType === "work"
      ? colors.workColor
      : previewType === "shortBreak"
        ? colors.shortBreakColor
        : colors.longBreakColor;
  const previewLabel =
    settings.timerMode === "stopwatch"
      ? t("timer.stopwatch")
      : previewType === "work"
      ? t("session.work")
      : previewType === "shortBreak"
        ? t("session.shortBreak")
        : t("session.longBreak");
  const previewTime =
    settings.timerMode === "stopwatch"
      ? formatTime(0)
      : timer.isRunning
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
      t("settings.resetTitle"),
      t("settings.resetMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("common.reset"), style: "destructive", onPress: resetSettings },
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
        <Text style={[styles.title, { color: colors.foreground }]}>
          {t("settings.title")}
        </Text>
        <Pressable
          onPress={confirmReset}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("settings.resetA11y")}
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
            {t("common.reset")}
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
          {t("settings.livePreview")}
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
      <Section title={t("settings.quickPresets")} colors={colors}>
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
              accessibilityLabel={t("settings.applyPresetA11y", { name: p.name })}
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
                  {p.settings.workMinutes}
                  {t("settings.minutesShortUnit")} {t("session.workShort")} ·{" "}
                  {p.settings.shortBreakMinutes}
                  {t("settings.minutesShortUnit")}{" "}
                  {t("session.shortBreakShort")} · {p.settings.longBreakMinutes}
                  {t("settings.minutesShortUnit")} {t("session.longBreakShort")}
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
      <Section title={t("settings.durations")} colors={colors}>
        <NumberRow
          label={t("settings.focus")}
          value={settings.workMinutes}
          unit={t("settings.minutesUnit")}
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
          label={t("settings.shortBreak")}
          value={settings.shortBreakMinutes}
          unit={t("settings.minutesUnit")}
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
          label={t("settings.longBreak")}
          value={settings.longBreakMinutes}
          unit={t("settings.minutesUnit")}
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
          label={t("settings.roundsBeforeLong")}
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
      <Section title={t("settings.dailyGoal")} colors={colors}>
        <NumberRow
          label={t("settings.pomodorosPerDay")}
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
      <Section title={t("settings.behavior")} colors={colors}>
        <SegmentedChoice
          value={settings.timerMode}
          options={[
            { value: "pomodoro", label: t("timer.pomodoro") },
            { value: "stopwatch", label: t("timer.stopwatch") },
          ]}
          onChange={(value) => {
            haptic();
            setSettings({
              timerMode: value === "stopwatch" ? "stopwatch" : "pomodoro",
            });
          }}
          description={t("settings.timerModeDesc")}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label={t("settings.autoStartBreaks")}
          description={t("settings.autoStartBreaksDesc")}
          value={settings.autoStartBreaks}
          onChange={(v) => setSettings({ autoStartBreaks: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label={t("settings.autoStartFocus")}
          description={t("settings.autoStartFocusDesc")}
          value={settings.autoStartWork}
          onChange={(v) => setSettings({ autoStartWork: v })}
          colors={colors}
        />
      </Section>

      {/* Alerts */}
      <Section title={t("settings.alerts")} colors={colors}>
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
          language={settings.language}
          colors={colors}
        />
        <Divider colors={colors} />
        <PillShapeRow
          value={settings.pillShape}
          onChange={(pillShape) => {
            haptic();
            setSettings({ pillShape });
          }}
          language={settings.language}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label={t("settings.sound")}
          description={t("settings.soundDesc")}
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
          language={settings.language}
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
          language={settings.language}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label={t("settings.vibration")}
          description={t("settings.vibrationDesc")}
          value={settings.vibrationEnabled}
          onChange={(v) => setSettings({ vibrationEnabled: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label={t("settings.hapticTick")}
          description={t("settings.hapticTickDesc")}
          value={settings.tickEnabled}
          onChange={(v) => setSettings({ tickEnabled: v })}
          colors={colors}
        />
      </Section>

      {/* Quiet hours */}
      <Section title={t("settings.quietHours")} colors={colors}>
        <ToggleRow
          label={t("settings.enableQuietHours")}
          description={t("settings.quietHoursDesc")}
          value={settings.quietHoursEnabled}
          onChange={(v) => setSettings({ quietHoursEnabled: v })}
          colors={colors}
        />
        {settings.quietHoursEnabled ? (
          <>
            <Divider colors={colors} />
            <ClockRow
              label={t("settings.from")}
              value={settings.quietHoursStart}
              onChange={(v) => setSettings({ quietHoursStart: v })}
              colors={colors}
            />
            <Divider colors={colors} />
            <ClockRow
              label={t("settings.to")}
              value={settings.quietHoursEnd}
              onChange={(v) => setSettings({ quietHoursEnd: v })}
              colors={colors}
            />
          </>
        ) : null}
      </Section>

      {/* Themes */}
      <Section title={t("settings.appearance")} colors={colors}>
        <SegmentedChoice
          value={settings.colorScheme}
          options={[
            { value: "system", label: t("settings.system") },
            { value: "light", label: t("settings.light") },
            { value: "dark", label: t("settings.dark") },
          ]}
          onChange={(value) =>
            setSettings({ colorScheme: value as "system" | "light" | "dark" })
          }
          colors={colors}
        />
        <Divider colors={colors} />
        <SegmentedChoice
          value={settings.language}
          options={languageOptions.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
          onChange={(value) => setSettings({ language: value as LanguageCode })}
          colors={colors}
          description={t("settings.languageDesc")}
        />
      </Section>

      <Section title={t("settings.theme")} colors={colors}>
        <View style={styles.themeGrid}>
          {themeList.map((themeOption) => {
            const palette =
              resolvedScheme === "dark" ? themeOption.dark : themeOption.light;
            const accentOverride = resolveAccent(
              settings.accentName,
              resolvedScheme,
            );
            const effectivePrimary = accentOverride ?? palette.primary;
            const effectiveWork = accentOverride ?? palette.workColor;
            const selected = settings.themeName === themeOption.name;
            return (
              <Pressable
                key={themeOption.name}
                onPress={() => {
                  haptic();
                  setSettings({ themeName: themeOption.name as ThemeName });
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
                accessibilityLabel={t("settings.themeA11y", {
                  label: themeOption.label,
                })}
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
                  {themeOption.label}
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
      <Section title={t("settings.accentColor")} colors={colors}>
        <View style={styles.accentGrid}>
          {accentList.map((a) => {
            const selected = settings.accentName === a.name;
            const swatch =
              a.name === "default"
                ? colors.workColor
                : resolvedScheme === "dark"
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
                accessibilityLabel={t("settings.accentA11y", { label: a.label })}
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
      <Section title={t("settings.data")} colors={colors}>
        <Pressable
          onPress={exportStats}
          style={({ pressed }) => [
            styles.row,
            { opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("settings.exportStats")}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>
              {t("settings.exportStats")}
            </Text>
            <Text
              style={[styles.rowDescription, { color: colors.mutedForeground }]}
            >
              {t("settings.exportStatsDesc")}
            </Text>
          </View>
          <Feather name="share" size={18} color={colors.mutedForeground} />
        </Pressable>
      </Section>

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
  const { settings } = useApp();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
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
          accessibilityLabel={t("settings.decreaseA11y", { label })}
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
          accessibilityLabel={t("settings.increaseA11y", { label })}
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
  const { settings } = useApp();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
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
          ? window.prompt(t("settings.timePrompt", { label }), `${hh}:${mm}`)
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
        accessibilityLabel={t("settings.timeA11y", {
          label,
          time: formatClock(value),
        })}
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
                  accessibilityLabel={t("common.cancel")}
                >
                  <Text
                    style={[
                      styles.iosPickerAction,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {t("common.cancel")}
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
                  accessibilityLabel={t("common.done")}
                >
                  <Text
                    style={[styles.iosPickerAction, { color: colors.primary }]}
                  >
                    {t("common.done")}
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
  language,
  colors,
}: {
  pillEnabled: boolean;
  overlayEnabled: boolean;
  onChange: (mode: LiveCountdownMode) => void;
  language: LanguageCode;
  colors: ReturnType<typeof useColors>;
}) {
  const t = React.useMemo(() => createTranslator(language), [language]);
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
        t("live.customBuildTitle"),
        t("live.customBuildMessage"),
        [{ text: t("common.ok") }],
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
      t("live.permissionTitle"),
      t("live.permissionMessage"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
          onPress: () => onChange("sticky"),
        },
        {
          text: t("live.openSettings"),
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
      ? t("live.descOverlay")
      : current === "sticky"
        ? t("live.descSticky")
        : t("live.descOff");

  const segments: { value: LiveCountdownMode; label: string; show: boolean }[] = [
    { value: "off", label: t("live.modeOff"), show: true },
    { value: "sticky", label: t("live.modeSticky"), show: true },
    { value: "overlay", label: t("live.modeOverlay"), show: Platform.OS === "android" },
  ];
  const visible = segments.filter((s) => s.show);

  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <View>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {t("live.countdown")}
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
            {t("live.unavailable")}
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
              accessibilityLabel={t("live.segmentA11y", { label: seg.label })}
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
          {t("live.waitingPermission")}
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

function SegmentedChoice({
  value,
  options,
  onChange,
  description,
  colors,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  description?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 8 }}>
      {description ? (
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      ) : null}
      <View
        style={[
          liveStyles.segmentWrap,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                liveStyles.segment,
                {
                  backgroundColor: selected ? colors.primary : "transparent",
                  opacity: pressed ? 0.75 : 1,
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
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PillShapeRow({
  value,
  onChange,
  language,
  colors,
}: {
  value: FloatingPillShape;
  onChange: (value: FloatingPillShape) => void;
  language: LanguageCode;
  colors: ReturnType<typeof useColors>;
}) {
  const t = React.useMemo(() => createTranslator(language), [language]);
  const options: { value: FloatingPillShape; label: string }[] = [
    { value: "classic", label: t("pill.shapeClassic") },
    { value: "rounded", label: t("pill.shapeRounded") },
    { value: "square", label: t("pill.shapeSquare") },
    { value: "compact", label: t("pill.shapeCompact") },
  ];
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <View>
        <Text style={[styles.rowLabel, { color: colors.foreground }]}>
          {t("pill.shape")}
        </Text>
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>
          {t("pill.shapeDesc")}
        </Text>
      </View>
      <View style={styles.shapeGrid}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.shapeCard,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary + "18" : colors.muted,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.shapePreview,
                  {
                    width: option.value === "compact" ? 44 : 58,
                    borderRadius:
                      option.value === "square"
                        ? 8
                        : option.value === "rounded"
                          ? 16
                          : 999,
                    backgroundColor: selected ? colors.primary : colors.foreground,
                  },
                ]}
              />
              <Text
                style={[
                  styles.shapeLabel,
                  {
                    color: selected ? colors.foreground : colors.mutedForeground,
                    fontFamily: selected
                      ? "Inter_600SemiBold"
                      : "Inter_500Medium",
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AlarmSoundRow({
  value,
  volume,
  enabled,
  onChange,
  language,
  colors,
}: {
  value: AlarmSoundName;
  volume: number;
  enabled: boolean;
  onChange: (v: AlarmSoundName) => void;
  language: LanguageCode;
  colors: ReturnType<typeof useColors>;
}) {
  const t = React.useMemo(() => createTranslator(language), [language]);
  return (
    <View style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text
          style={[
            styles.rowLabel,
            { color: enabled ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {t("alarm.sound")}
        </Text>
        <Text style={[styles.rowDescription, { color: colors.mutedForeground }]}>
          {t("alarm.soundDesc")}
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
  language,
  colors,
}: {
  value: number;
  enabled: boolean;
  onChange: (v: number) => void;
  onPreview: () => void;
  language: LanguageCode;
  colors: ReturnType<typeof useColors>;
}) {
  const t = React.useMemo(() => createTranslator(language), [language]);
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
            {t("alarm.volume")}
          </Text>
          <Text
            style={[styles.rowDescription, { color: colors.mutedForeground }]}
          >
            {enabled ? `${pct}%` : t("alarm.soundOff")}
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
          <Text style={alarmStyles.previewBtnLabel}>{t("alarm.preview")}</Text>
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
  shapeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  shapeCard: {
    flexGrow: 1,
    minWidth: "47%",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  shapePreview: {
    height: 22,
  },
  shapeLabel: {
    fontSize: 12,
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
});
