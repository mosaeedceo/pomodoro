import { Feather } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircularProgress } from "@/components/CircularProgress";
import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { dayLabel, formatMinutes, startOfDay } from "@/lib/format";

type Period = "today" | "week" | "month" | "all";

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    stats,
    settings,
    clearStats,
    clearTodayStats,
    exportStats,
    setTaskLabel,
  } = useApp();
  const [period, setPeriod] = useState<Period>("week");

  const data = useMemo(() => {
    const todayStart = startOfDay(Date.now());
    const todaySessions = stats.filter(
      (s) => s.completedAt >= todayStart && s.type === "work",
    );
    const todayCount = todaySessions.length;
    const todayMinutes = Math.round(
      todaySessions.reduce((acc, s) => acc + s.durationMs, 0) / 60000,
    );

    // 7-day buckets (oldest -> newest)
    const week: { label: string; minutes: number; date: number; goalMet: boolean }[] = [];
    const goalMs = settings.dailyGoal * settings.workMinutes * 60 * 1000;
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayMs = stats
        .filter(
          (s) =>
            s.type === "work" &&
            s.completedAt >= day &&
            s.completedAt < day + 24 * 60 * 60 * 1000,
        )
        .reduce((acc, s) => acc + s.durationMs, 0);
      week.push({
        label: dayLabel(day),
        minutes: Math.round(dayMs / 60000),
        date: day,
        goalMet: goalMs > 0 && dayMs >= goalMs,
      });
    }
    const maxMinutes = Math.max(60, ...week.map((d) => d.minutes));

    // Streak (consecutive days with at least 1 work session, ending today or yesterday)
    let streak = 0;
    let cursor = todayStart;
    if (todayCount === 0) {
      cursor = startOfDay(Date.now() - 24 * 60 * 60 * 1000);
    }
    let safety = 0;
    while (safety < 3650) {
      const has = stats.some(
        (s) =>
          s.type === "work" &&
          s.completedAt >= cursor &&
          s.completedAt < cursor + 24 * 60 * 60 * 1000,
      );
      if (!has) break;
      streak++;
      cursor -= 24 * 60 * 60 * 1000;
      safety++;
    }

    const allTime = stats
      .filter((s) => s.type === "work")
      .reduce(
        (acc, s) => ({ count: acc.count + 1, ms: acc.ms + s.durationMs }),
        { count: 0, ms: 0 },
      );

    return {
      todayCount,
      todayMinutes,
      week,
      maxMinutes,
      streak,
      allTimeCount: allTime.count,
      allTimeMinutes: Math.round(allTime.ms / 60000),
    };
  }, [stats, settings.dailyGoal, settings.workMinutes]);

  const periodCutoff = useMemo(() => {
    const now = Date.now();
    switch (period) {
      case "today":
        return startOfDay(now);
      case "week":
        return startOfDay(now - 6 * 24 * 60 * 60 * 1000);
      case "month":
        return startOfDay(now - 29 * 24 * 60 * 60 * 1000);
      case "all":
        return 0;
    }
  }, [period]);

  const filtered = useMemo(
    () => stats.filter((s) => s.completedAt >= periodCutoff),
    [stats, periodCutoff],
  );
  const recent = filtered.slice(0, 30);

  const goalProgress =
    settings.dailyGoal > 0
      ? Math.min(1, data.todayCount / settings.dailyGoal)
      : 0;

  const goTo = (tab: "index" | "settings") => {
    try {
      (navigation as { jumpTo?: (name: string) => void }).jumpTo?.(tab);
    } catch {
      // ignore
    }
  };

  const handleResume = (label: string) => {
    setTaskLabel(label);
    goTo("index");
  };

  const handleClear = () => {
    if (Platform.OS === "web") {
      clearStats();
      return;
    }
    Alert.alert(
      "Clear all stats?",
      "This permanently deletes every recorded session.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear all", style: "destructive", onPress: clearStats },
        { text: "Clear today only", onPress: clearTodayStats },
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
        <Text style={[styles.title, { color: colors.foreground }]}>Stats</Text>
        <View style={styles.headerActions}>
          {stats.length > 0 ? (
            <Pressable
              onPress={exportStats}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Export stats"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.8 })}
            >
              <Feather
                name="share"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : null}
          {stats.length > 0 ? (
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear stats"
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.8 })}
            >
              <Feather
                name="trash-2"
                size={18}
                color={colors.mutedForeground}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Today summary with goal ring */}
      <View
        style={[
          styles.todayCard,
          { backgroundColor: colors.primary },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.todayLabel, { color: colors.primaryForeground }]}>
            Today
          </Text>
          <View style={styles.todayMain}>
            <Text
              style={[styles.todayNumber, { color: colors.primaryForeground }]}
            >
              {data.todayCount}
            </Text>
            <Text
              style={[styles.todayUnit, { color: colors.primaryForeground }]}
            >
              of {settings.dailyGoal} goal
            </Text>
          </View>
          <View style={styles.todayMetaRow}>
            <View style={styles.todayMeta}>
              <Feather
                name="clock"
                size={13}
                color={colors.primaryForeground}
                style={{ opacity: 0.85 }}
              />
              <Text
                style={[
                  styles.todayMetaText,
                  { color: colors.primaryForeground },
                ]}
              >
                {formatMinutes(data.todayMinutes)} focused
              </Text>
            </View>
            <View style={styles.todayMeta}>
              <Feather
                name="zap"
                size={13}
                color={colors.primaryForeground}
                style={{ opacity: 0.85 }}
              />
              <Text
                style={[
                  styles.todayMetaText,
                  { color: colors.primaryForeground },
                ]}
              >
                {data.streak} day streak
              </Text>
            </View>
          </View>
        </View>
        <CircularProgress
          size={88}
          strokeWidth={8}
          progress={goalProgress}
          color={colors.primaryForeground}
          trackColor={"rgba(255,255,255,0.22)"}
        >
          <Text
            style={[
              styles.goalRingText,
              { color: colors.primaryForeground },
            ]}
          >
            {Math.round(goalProgress * 100)}%
          </Text>
        </CircularProgress>
      </View>

      {/* Period filter */}
      <View
        style={[
          styles.segmented,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        {(["today", "week", "month", "all"] as Period[]).map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityLabel={`Show ${p}`}
              style={[
                styles.segment,
                active
                  ? { backgroundColor: colors.card }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: active ? colors.foreground : colors.mutedForeground,
                    fontFamily: active
                      ? "Inter_700Bold"
                      : "Inter_500Medium",
                  },
                ]}
              >
                {p === "today"
                  ? "Today"
                  : p === "week"
                    ? "Week"
                    : p === "month"
                      ? "Month"
                      : "All"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Weekly chart */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          This week
        </Text>
        <View style={styles.chart}>
          {data.week.map((d, i) => {
            const heightPct = data.maxMinutes
              ? (d.minutes / data.maxMinutes) * 100
              : 0;
            const isToday = i === data.week.length - 1;
            const barColor = isToday
              ? colors.primary
              : d.goalMet
                ? colors.primary
                : colors.accent;
            const barOpacity = !isToday && !d.goalMet ? 0.5 : 1;
            return (
              <View key={i} style={styles.chartCol}>
                <View style={styles.chartBarWrap}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        backgroundColor: barColor,
                        opacity: barOpacity,
                        height: `${Math.max(heightPct, 3)}%`,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.chartLabel,
                    {
                      color: isToday
                        ? colors.foreground
                        : colors.mutedForeground,
                      fontFamily: isToday
                        ? "Inter_600SemiBold"
                        : "Inter_500Medium",
                    },
                  ]}
                >
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* All-time stats */}
      <View style={styles.statRow}>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Total sessions
          </Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {data.allTimeCount}
          </Text>
        </View>
        <View
          style={[
            styles.statCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Total focus
          </Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatMinutes(data.allTimeMinutes)}
          </Text>
        </View>
      </View>

      {/* Recent activity */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          Recent ({period})
        </Text>
        {recent.length === 0 ? (
          <View style={styles.empty}>
            <Feather
              name="inbox"
              size={32}
              color={colors.mutedForeground}
              style={{ opacity: 0.5 }}
            />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {period === "today"
                ? "No sessions today yet — start a focus"
                : "No sessions in this period"}
            </Text>
            <Pressable
              onPress={() => goTo("index")}
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open timer"
            >
              <Text style={[styles.emptyCtaText, { color: colors.primaryForeground }]}>
                Open timer
              </Text>
            </Pressable>
          </View>
        ) : (
          recent.map((s, idx) => {
            const color =
              s.type === "work"
                ? colors.workColor
                : s.type === "shortBreak"
                  ? colors.shortBreakColor
                  : colors.longBreakColor;
            const date = new Date(s.completedAt);
            const time = date.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });
            const title =
              s.taskLabel ||
              (s.type === "work"
                ? "Focus"
                : s.type === "shortBreak"
                  ? "Short Break"
                  : "Long Break");
            return (
              <View
                key={s.id}
                style={[
                  styles.recentRow,
                  idx > 0
                    ? {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }
                    : null,
                ]}
              >
                <View style={[styles.recentDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.recentTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {title}
                  </Text>
                  <Text
                    style={[
                      styles.recentMeta,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {time} • {Math.round(s.durationMs / 60000)}m
                  </Text>
                </View>
                {s.type === "work" && s.taskLabel ? (
                  <Pressable
                    onPress={() => handleResume(s.taskLabel)}
                    accessibilityRole="button"
                    accessibilityLabel={`Resume task ${s.taskLabel}`}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.resumeBtn,
                      {
                        borderColor: colors.border,
                        opacity: pressed ? 0.6 : 1,
                      },
                    ]}
                  >
                    <Feather
                      name="play"
                      size={12}
                      color={colors.foreground}
                    />
                    <Text
                      style={[styles.resumeText, { color: colors.foreground }]}
                    >
                      Resume
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* Goal CTA when not set */}
      {settings.dailyGoal === 0 ? (
        <Pressable
          onPress={() => goTo("settings")}
          style={({ pressed }) => [
            styles.goalCta,
            {
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="target" size={16} color={colors.primary} />
          <Text style={[styles.goalCtaText, { color: colors.foreground }]}>
            Set a daily goal
          </Text>
          <Feather
            name="chevron-right"
            size={16}
            color={colors.mutedForeground}
          />
        </Pressable>
      ) : null}

      {Platform.OS === "web" ? <View style={{ height: 34 }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 22,
    borderRadius: 24,
  },
  todayLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  todayMain: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginTop: 8,
  },
  todayNumber: {
    fontSize: 56,
    fontFamily: "Inter_700Bold",
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  todayUnit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    opacity: 0.85,
  },
  todayMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
    flexWrap: "wrap",
  },
  todayMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  todayMetaText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    opacity: 0.9,
    fontVariant: ["tabular-nums"],
  },
  goalRingText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums"],
  },
  segmented: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: 8,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
  },
  chartBarWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  chartBar: {
    width: "100%",
    borderRadius: 8,
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 11,
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  emptyCta: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  emptyCtaText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recentTitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  recentMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  resumeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  goalCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalCtaText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
