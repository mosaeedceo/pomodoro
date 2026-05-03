import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useNavigation } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircularProgress } from "@/components/CircularProgress";
import { useApp, type SessionType } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatTime, startOfDay } from "@/lib/format";
import { createTranslator } from "@/lib/i18n";

export default function TimerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const layout = useResponsiveLayout();
  const navigation = useNavigation();
  const {
    timer,
    remainingMs,
    settings,
    stats,
    start,
    pause,
    reset,
    skip,
    setTaskLabel,
  } = useApp();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
  const sessionLabels: Record<SessionType, string> = {
    work: t("session.work"),
    shortBreak: t("session.shortBreak"),
    longBreak: t("session.longBreak"),
  };

  const sessionColor =
    timer.sessionType === "work"
      ? colors.workColor
      : timer.sessionType === "shortBreak"
        ? colors.shortBreakColor
        : colors.longBreakColor;

  const progress =
    timer.totalMs > 0 ? 1 - remainingMs / timer.totalMs : 0;

  const todayCount = useMemo(() => {
    const today = startOfDay(Date.now());
    return stats.filter((s) => s.type === "work" && s.completedAt >= today).length;
  }, [stats]);

  const nextSession: SessionType = useMemo(() => {
    if (timer.sessionType === "work") {
      const nextRoundCount = timer.completedRounds + 1;
      return nextRoundCount % settings.roundsBeforeLongBreak === 0
        ? "longBreak"
        : "shortBreak";
    }
    return "work";
  }, [timer.sessionType, timer.completedRounds, settings.roundsBeforeLongBreak]);

  const nextDuration =
    nextSession === "work"
      ? settings.workMinutes
      : nextSession === "shortBreak"
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes;

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!timer.isRunning) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [timer.isRunning, pulse]);

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  };

  const handlePrimary = () => {
    haptic();
    if (timer.isRunning) pause();
    else start();
  };

  const handleSkip = () => {
    haptic();
    skip();
  };

  const handleReset = () => {
    haptic();
    reset();
  };

  const goTo = (tab: "stats" | "settings") => {
    try {
      (navigation as { jumpTo?: (name: string) => void }).jumpTo?.(tab);
    } catch {
      // ignore
    }
  };

  const totalRoundDots = settings.roundsBeforeLongBreak;
  const currentRoundIndex = timer.completedRounds % totalRoundDots;
  const onWork = timer.sessionType === "work";

  const endingSoon = timer.isRunning && remainingMs > 0 && remainingMs <= 10_000;
  const circleSize = Math.min(
    layout.isWide ? 340 : layout.isTablet ? 360 : 300,
    width - 64,
    height - 300,
  );
  const timerSize = Math.max(240, circleSize);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingHorizontal: layout.isTablet ? 32 : 24,
        },
      ]}
    >
      <View style={[styles.content, { maxWidth: layout.maxContentWidth }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => goTo("stats")}
            accessibilityRole="button"
            accessibilityLabel={t("timer.todayA11y", {
              count: todayCount,
              goal: settings.dailyGoal,
            })}
            style={({ pressed }) => [
              styles.todayChip,
              {
                backgroundColor: colors.muted,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={[styles.todayChipDot, { backgroundColor: colors.primary }]}
            />
            <Text style={[styles.todayChipText, { color: colors.foreground }]}>
              {todayCount}
              <Text style={{ color: colors.mutedForeground }}>
                /{settings.dailyGoal}
              </Text>{" "}
              {t("timer.today")}
            </Text>
          </Pressable>

          <View style={styles.roundDots}>
            {Array.from({ length: totalRoundDots }).map((_, i) => {
              const filled = i < currentRoundIndex;
              const active = i === currentRoundIndex && onWork;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: filled
                        ? colors.workColor
                        : active
                          ? colors.workColor
                          : colors.muted,
                      opacity: filled ? 1 : active ? 0.6 : 1,
                      width: active ? 18 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.timerGrid,
            layout.isWide ? styles.timerGridWide : null,
          ]}
        >
          <View style={styles.timerPane}>
            {/* Session label — long-press to open settings */}
            <View style={styles.sessionLabelRow}>
              <Pressable
                onLongPress={() => {
                  haptic();
                  goTo("settings");
                }}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={t("timer.sessionA11y", {
                  label: sessionLabels[timer.sessionType],
                })}
                style={[
                  styles.sessionPill,
                  { backgroundColor: sessionColor + "22", borderColor: sessionColor },
                ]}
              >
                <View
                  style={[styles.sessionPillDot, { backgroundColor: sessionColor }]}
                />
                <Text style={[styles.sessionLabel, { color: sessionColor }]}>
                  {sessionLabels[timer.sessionType]}
                </Text>
              </Pressable>
            </View>

            {/* Timer — tap anywhere to start/pause */}
            <Pressable
              onPress={handlePrimary}
              style={styles.timerWrap}
              accessibilityRole="button"
              accessibilityLabel={
                timer.isRunning
                  ? t("timer.pauseA11y", { time: formatTime(remainingMs) })
                  : t("timer.startA11y", { time: formatTime(remainingMs) })
              }
            >
              <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <CircularProgress
                  size={timerSize}
                  strokeWidth={layout.isTablet ? 16 : 14}
                  progress={progress}
                  color={endingSoon ? colors.destructive : sessionColor}
                  trackColor={colors.ringTrack}
                >
                  <Text
                    style={[
                      styles.time,
                      {
                        color: colors.foreground,
                        fontSize: layout.isTablet ? 72 : 64,
                      },
                    ]}
                  >
                    {formatTime(remainingMs)}
                  </Text>
                  <Text
                    style={[styles.timeSubtitle, { color: colors.mutedForeground }]}
                  >
                    {timer.isRunning
                      ? endingSoon
                        ? t("timer.endingSoon")
                        : t("timer.inProgress")
                      : timer.pausedRemainingMs != null &&
                          timer.pausedRemainingMs < timer.totalMs
                        ? t("timer.paused")
                        : t("timer.ready")}
                  </Text>
                  <Text
                    style={[styles.nextLabel, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {t("timer.next")}: {sessionLabels[nextSession]} · {nextDuration}m
                  </Text>
                </CircularProgress>
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.controlsPane}>
            {/* Task input */}
            <View style={[styles.taskRow, { backgroundColor: colors.card }]}>
              <Feather name="edit-3" size={16} color={colors.mutedForeground} />
              <TextInput
                value={timer.taskLabel}
                onChangeText={setTaskLabel}
                placeholder={t("timer.taskPlaceholder")}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.taskInput, { color: colors.foreground }]}
                returnKeyType="done"
                maxLength={60}
                accessibilityLabel={t("timer.taskPlaceholder")}
              />
            </View>

            {/* Controls */}
            <View
              style={[
                styles.controls,
                { paddingBottom: layout.isWide ? 0 : 110 },
              ]}
            >
              <Pressable
                onPress={handleReset}
                accessibilityRole="button"
                accessibilityLabel={t("timer.resetA11y")}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.muted,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="rotate-ccw" size={20} color={colors.foreground} />
              </Pressable>

              <Pressable
                onPress={handlePrimary}
                accessibilityRole="button"
                accessibilityLabel={timer.isRunning ? t("timer.pause") : t("timer.start")}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: sessionColor,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                    shadowColor: sessionColor,
                  },
                ]}
              >
                <Feather
                  name={timer.isRunning ? "pause" : "play"}
                  size={32}
                  color="#ffffff"
                  style={{ marginLeft: timer.isRunning ? 0 : 3 }}
                />
              </Pressable>

              <Pressable
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel={t("timer.skipA11y")}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.muted,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="skip-forward" size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  content: {
    flex: 1,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  todayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  todayChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  todayChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  roundDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  sessionLabelRow: {
    alignItems: "center",
    marginTop: 16,
  },
  sessionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  sessionPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sessionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  timerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 340,
  },
  timerGrid: {
    flex: 1,
  },
  timerGridWide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 48,
  },
  timerPane: {
    flex: 1,
  },
  controlsPane: {
    flex: 1,
    justifyContent: "center",
  },
  time: {
    fontSize: 64,
    fontFamily: "Inter_700Bold",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  timeSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginTop: 4,
  },
  nextLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 8,
    opacity: 0.85,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    marginBottom: 24,
  },
  taskInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    paddingVertical: 4,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingBottom: 110,
  },
  secondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
