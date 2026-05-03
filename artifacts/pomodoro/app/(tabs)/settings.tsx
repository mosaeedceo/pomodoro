import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
  Alert,
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
import { PRESETS, useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

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
  const { settings, setSettings, resetSettings, applyPreset, exportStats } =
    useApp();

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
        <ToggleRow
          label="Pop-up pill notification"
          description="Shows a sticky notification with the live countdown while a session is running"
          value={settings.pillNotificationEnabled}
          onChange={(v) => setSettings({ pillNotificationEnabled: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label="Sound"
          description="Play a notification sound when a session ends"
          value={settings.soundEnabled}
          onChange={(v) => setSettings({ soundEnabled: v })}
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
        Heads up: the live-countdown pill shows as a persistent system
        notification on Android (visible from any app and the lock screen) and
        as a floating pill inside the app on the Stats and Settings screens.
        A true overlay floating on top of other apps requires Android&apos;s
        special &quot;Display over other apps&quot; permission, which is only
        available in a custom build of the app — not in Expo Go.
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
  const STEP = 30;
  const dec = () => onChange((value - STEP + 24 * 60) % (24 * 60));
  const inc = () => onChange((value + STEP) % (24 * 60));
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
          accessibilityRole="button"
          accessibilityLabel={`Earlier ${label}`}
          style={({ pressed }) => [
            styles.stepBtn,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="minus" size={16} color={colors.foreground} />
        </Pressable>
        <View style={[styles.stepValueWrap, { minWidth: 90 }]}>
          <Text style={[styles.stepValue, { color: colors.foreground }]}>
            {formatClock(value)}
          </Text>
        </View>
        <Pressable
          onPress={inc}
          accessibilityRole="button"
          accessibilityLabel={`Later ${label}`}
          style={({ pressed }) => [
            styles.stepBtn,
            { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="plus" size={16} color={colors.foreground} />
        </Pressable>
      </View>
    </View>
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
