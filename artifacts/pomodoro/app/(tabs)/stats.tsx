import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { dayLabel, formatMinutes, startOfDay } from "@/lib/format";

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { stats, clearStats } = useApp();

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
    const week: { label: string; minutes: number; date: number }[] = [];
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
      });
    }
    const maxMinutes = Math.max(60, ...week.map((d) => d.minutes));

    // Streak (consecutive days with at least 1 work session, ending today or yesterday)
    let streak = 0;
    let cursor = todayStart;
    if (todayCount === 0) {
      cursor = startOfDay(Date.now() - 24 * 60 * 60 * 1000);
    }
    while (true) {
      const has = stats.some(
        (s) =>
          s.type === "work" &&
          s.completedAt >= cursor &&
          s.completedAt < cursor + 24 * 60 * 60 * 1000,
      );
      if (!has) break;
      streak++;
      cursor -= 24 * 60 * 60 * 1000;
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
  }, [stats]);

  const recent = stats.slice(0, 12);

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
        {stats.length > 0 ? (
          <Pressable
            onPress={clearStats}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 0.8 })}
          >
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {/* Today summary */}
      <View
        style={[
          styles.todayCard,
          { backgroundColor: colors.primary },
        ]}
      >
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
            {data.todayCount === 1 ? "pomodoro" : "pomodoros"}
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
            return (
              <View key={i} style={styles.chartCol}>
                <View style={styles.chartBarWrap}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        backgroundColor: isToday
                          ? colors.primary
                          : colors.accent,
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
          Recent
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
              No sessions yet — start your first pomodoro
            </Text>
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
            return (
              <View
                key={s.id}
                style={[
                  styles.recentRow,
                  idx > 0
                    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }
                    : null,
                ]}
              >
                <View style={[styles.recentDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.recentTitle, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    {s.taskLabel ||
                      (s.type === "work"
                        ? "Focus"
                        : s.type === "shortBreak"
                          ? "Short Break"
                          : "Long Break")}
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
              </View>
            );
          })
        )}
      </View>

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
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  todayCard: {
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
  },
  todayUnit: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    opacity: 0.85,
  },
  todayMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
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
  },
});
