import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import {
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

import colors_constants, { themeList, type ThemeName } from "@/constants/colors";
import { useApp, type Settings } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const { settings, setSettings } = useApp();

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
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
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

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

      {/* Notifications */}
      <Section title="Alerts" colors={colors}>
        <ToggleRow
          label="Pop-up pill notification"
          description="Show a sticky notification with the live countdown while a session is running"
          value={settings.pillNotificationEnabled}
          onChange={(v) => setSettings({ pillNotificationEnabled: v })}
          colors={colors}
        />
        <Divider colors={colors} />
        <ToggleRow
          label="Sound"
          description="Play a notification when a session ends"
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
      </Section>

      {/* Themes */}
      <Section title="Theme" colors={colors}>
        <View style={styles.themeGrid}>
          {themeList.map((t) => {
            const palette = scheme === "dark" ? t.dark : t.light;
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
                    borderColor: selected ? palette.primary : colors.border,
                    borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <View style={styles.themeSwatchRow}>
                  <View
                    style={[
                      styles.themeSwatch,
                      { backgroundColor: palette.workColor },
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
                      { backgroundColor: palette.primary },
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

      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
        On Android, the pop-up pill appears as a persistent system notification
        with the live countdown so you can see it from any app or the lock
        screen.
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
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
  footnote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    paddingHorizontal: 8,
    marginTop: -8,
  },
});
