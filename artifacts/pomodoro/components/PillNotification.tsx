import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { router, useNavigation, useSegments } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { formatTime } from "@/lib/format";
import { createTranslator } from "@/lib/i18n";

export function PillNotification() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const navigation = useNavigation();
  const segments = useSegments() as string[];
  const { timer, remainingMs, pause, start, settings } = useApp();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
  const resolvedScheme =
    settings.colorScheme === "system" ? colorScheme : settings.colorScheme;
  const sessionLabel = t(`session.${timer.sessionType}`);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  const isOnTimerTab =
    segments[0] === "(tabs)" &&
    (segments.length < 2 || segments[1] === "index");

  const isVisible = timer.isRunning && !isOnTimerTab;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isVisible ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: isVisible ? 0 : 20,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isVisible, opacity, translateY]);

  const sessionColor =
    timer.sessionType === "work"
      ? colors.workColor
      : timer.sessionType === "shortBreak"
        ? colors.shortBreakColor
        : colors.longBreakColor;

  const handleOpen = () => {
    // Try jumpTo on the nearest tabs navigator; fall back to router.navigate
    // (which won't push a duplicate stack entry for the same route).
    const nav = navigation as {
      jumpTo?: (name: string) => void;
      getParent?: () => unknown;
    };
    try {
      const parent = nav.getParent?.() as
        | { jumpTo?: (name: string) => void }
        | undefined;
      if (parent?.jumpTo) {
        parent.jumpTo("index");
        return;
      }
      if (nav.jumpTo) {
        nav.jumpTo("index");
        return;
      }
    } catch {
      // fall through
    }
    try {
      router.navigate("/(tabs)");
    } catch {
      // ignore
    }
  };

  const handleToggle = (e: { stopPropagation?: () => void }) => {
    e.stopPropagation?.();
    if (timer.isRunning) pause();
    else start();
  };

  return (
    <Animated.View
      pointerEvents={isVisible ? "auto" : "none"}
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + 90,
          opacity,
          transform: [{ translateY }],
          left: layout.isTablet ? 32 : 16,
          right: layout.isTablet ? 32 : 16,
        },
      ]}
    >
      <Pressable
        onPress={handleOpen}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={`${sessionLabel} ${formatTime(remainingMs)}`}
      >
        <View
          style={[
            styles.pill,
            {
              borderRadius:
                settings.pillShape === "square"
                  ? 10
                  : settings.pillShape === "rounded"
                    ? 18
                    : 999,
              paddingVertical: settings.pillShape === "compact" ? 8 : 10,
              paddingHorizontal: settings.pillShape === "compact" ? 12 : 14,
              maxWidth: settings.pillShape === "compact" ? 300 : undefined,
            },
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: "#000",
            },
          ]}
        >
          {Platform.OS === "ios" ? (
            <BlurView
              intensity={60}
              tint={resolvedScheme === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={[styles.dot, { backgroundColor: sessionColor }]} />
          <View style={styles.textCol}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              {sessionLabel}
            </Text>
            <Text style={[styles.time, { color: colors.foreground }]}>
              {formatTime(remainingMs)}
            </Text>
          </View>
          <Pressable
            onPress={handleToggle}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={timer.isRunning ? t("timer.pause") : t("timer.resume")}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: sessionColor,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather
              name={timer.isRunning ? "pause" : "play"}
              size={16}
              color="#ffffff"
            />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    alignItems: "center",
    zIndex: 50,
  },
  pressable: {
    width: "100%",
    maxWidth: 360,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  textCol: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  time: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    fontVariant: ["tabular-nums"],
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
