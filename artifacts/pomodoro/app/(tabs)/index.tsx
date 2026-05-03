import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircularProgress } from "@/components/CircularProgress";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { formatTime } from "@/lib/format";

const SESSION_LABELS = {
  work: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

export default function TimerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    timer,
    remainingMs,
    settings,
    start,
    pause,
    reset,
    skip,
    setTaskLabel,
  } = useApp();

  const sessionColor =
    timer.sessionType === "work"
      ? colors.workColor
      : timer.sessionType === "shortBreak"
        ? colors.shortBreakColor
        : colors.longBreakColor;

  const progress =
    timer.totalMs > 0 ? 1 - remainingMs / timer.totalMs : 0;

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

  const totalRoundDots = settings.roundsBeforeLongBreak;
  const currentRoundIndex = timer.completedRounds % totalRoundDots;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 8 },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.mutedForeground }]}>
          POMODORO
        </Text>
        <View style={styles.roundDots}>
          {Array.from({ length: totalRoundDots }).map((_, i) => {
            const filled = i < currentRoundIndex;
            const active =
              i === currentRoundIndex && timer.sessionType === "work";
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

      {/* Session label */}
      <View style={styles.sessionLabelRow}>
        <View
          style={[
            styles.sessionPill,
            { backgroundColor: sessionColor + "22", borderColor: sessionColor },
          ]}
        >
          <View
            style={[styles.sessionPillDot, { backgroundColor: sessionColor }]}
          />
          <Text style={[styles.sessionLabel, { color: sessionColor }]}>
            {SESSION_LABELS[timer.sessionType]}
          </Text>
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerWrap}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <CircularProgress
            size={300}
            strokeWidth={14}
            progress={progress}
            color={sessionColor}
            trackColor={colors.ringTrack}
          >
            <Text style={[styles.time, { color: colors.foreground }]}>
              {formatTime(remainingMs)}
            </Text>
            <Text
              style={[styles.timeSubtitle, { color: colors.mutedForeground }]}
            >
              {timer.isRunning
                ? "in progress"
                : timer.pausedRemainingMs != null &&
                    timer.pausedRemainingMs < timer.totalMs
                  ? "paused"
                  : "ready"}
            </Text>
          </CircularProgress>
        </Animated.View>
      </View>

      {/* Task input */}
      <View style={styles.taskRow}>
        <Feather name="edit-3" size={16} color={colors.mutedForeground} />
        <TextInput
          value={timer.taskLabel}
          onChangeText={setTaskLabel}
          placeholder="What are you working on?"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.taskInput,
            { color: colors.foreground },
          ]}
          returnKeyType="done"
          maxLength={60}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          onPress={handleReset}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  brand: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
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
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
