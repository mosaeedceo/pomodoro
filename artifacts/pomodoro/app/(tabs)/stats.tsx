import { Feather } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CircularProgress } from "@/components/CircularProgress";
import { useApp, type SessionRecord } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { dayLabel, formatMinutes, startOfDay } from "@/lib/format";
import { createTranslator } from "@/lib/i18n";

type Period = "today" | "week" | "month" | "all";
type ChartBucket = {
  label: string;
  minutes: number;
  date: number;
  goalMet: boolean;
};

function shortDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function monthLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short" });
}

function chartMinutes(
  workStats: SessionRecord[],
  start: number,
  end: number,
): number {
  const ms = workStats
    .filter((s) => s.completedAt >= start && s.completedAt < end)
    .reduce((acc, s) => acc + s.durationMs, 0);
  return Math.round(ms / 60000);
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const layout = useResponsiveLayout();
  const navigation = useNavigation();
  const {
    stats,
    settings,
    clearStats,
    clearTodayStats,
    exportStats,
    setTaskLabel,
  } = useApp();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
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

    const goalMs = settings.dailyGoal * settings.workMinutes * 60 * 1000;
    const workStats = stats.filter((s) => s.type === "work");
    const dayMs = 24 * 60 * 60 * 1000;
    const bucket = (start: number, end: number, label: string): ChartBucket => {
      const minutes = chartMinutes(workStats, start, end);
      return {
        label,
        minutes,
        date: start,
        goalMet: goalMs > 0 && minutes * 60 * 1000 >= goalMs,
      };
    };
    const chartBuckets: ChartBucket[] = [];

    if (period === "today") {
      for (let hour = 0; hour < 24; hour += 4) {
        const start = todayStart + hour * 60 * 60 * 1000;
        chartBuckets.push(bucket(start, start + 4 * 60 * 60 * 1000, `${hour}:00`));
      }
    } else if (period === "week") {
      for (let i = 6; i >= 0; i--) {
        const day = startOfDay(Date.now() - i * dayMs);
        chartBuckets.push(bucket(day, day + dayMs, dayLabel(day)));
      }
    } else if (period === "month") {
      for (let i = 9; i >= 0; i--) {
        const start = startOfDay(Date.now() - i * 3 * dayMs);
        chartBuckets.push(bucket(start, start + 3 * dayMs, shortDateLabel(start)));
      }
    } else {
      const sorted = [...workStats].sort((a, b) => a.completedAt - b.completedAt);
      const first = sorted[0]?.completedAt;
      if (first == null) {
        const nowDate = new Date();
        for (let i = 5; i >= 0; i--) {
          const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1).getTime();
          const end = new Date(nowDate.getFullYear(), nowDate.getMonth() - i + 1, 1).getTime();
          chartBuckets.push(bucket(start, end, monthLabel(start)));
        }
      } else {
        const startDate = new Date(first);
        const endDate = new Date();
        const monthSpan =
          (endDate.getFullYear() - startDate.getFullYear()) * 12 +
          endDate.getMonth() -
          startDate.getMonth() +
          1;
        if (monthSpan <= 12) {
          for (let i = monthSpan - 1; i >= 0; i--) {
            const start = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1).getTime();
            const end = new Date(endDate.getFullYear(), endDate.getMonth() - i + 1, 1).getTime();
            chartBuckets.push(bucket(start, end, monthLabel(start)));
          }
        } else {
          const start = startOfDay(first);
          const end = Date.now() + dayMs;
          const span = (end - start) / 12;
          for (let i = 0; i < 12; i++) {
            const bucketStart = start + span * i;
            const bucketEnd = i === 11 ? end : start + span * (i + 1);
            chartBuckets.push(
              bucket(bucketStart, bucketEnd, shortDateLabel(bucketStart)),
            );
          }
        }
      }
    }
    const maxMinutes = Math.max(60, ...chartBuckets.map((d) => d.minutes));

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
      chartBuckets,
      maxMinutes,
      streak,
      allTimeCount: allTime.count,
      allTimeMinutes: Math.round(allTime.ms / 60000),
    };
  }, [period, stats, settings.dailyGoal, settings.workMinutes]);

  const lineChart = useMemo(() => {
    const width = 640;
    const height = 104;
    const labelHeight = 26;
    const topInset = 18;
    const bottomInset = 16;
    const leftInset = 16;
    const rightInset = 16;
    const plotWidth = width - leftInset - rightInset;
    const plotHeight = height - topInset - bottomInset;
    const chartWidth = Math.max(1, data.chartBuckets.length - 1);
    const points = data.chartBuckets.map((d, i) => {
      const ratio = data.maxMinutes
        ? Math.min(1, Math.max(0, d.minutes / data.maxMinutes))
        : 0;
      return {
        ...d,
        x: leftInset + (i / chartWidth) * plotWidth,
        y: topInset + (1 - ratio) * plotHeight,
      };
    });
    return { width, height, labelHeight, points };
  }, [data.chartBuckets, data.maxMinutes]);

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
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [period]);
  const recent = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;
  const periodTitle =
    period === "today"
      ? t("stats.periodToday")
      : period === "week"
        ? t("stats.periodWeek")
        : period === "month"
          ? t("stats.periodMonth")
          : t("stats.periodAll");

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
      t("stats.clearTitle"),
      t("stats.clearMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("stats.clearAll"), style: "destructive", onPress: clearStats },
        { text: t("stats.clearToday"), onPress: clearTodayStats },
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
          {t("stats.title")}
        </Text>
        <View style={styles.headerActions}>
          {stats.length > 0 ? (
            <Pressable
              onPress={exportStats}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("stats.exportA11y")}
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
              accessibilityLabel={t("stats.clearA11y")}
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
            {t("stats.today")}
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
              {t("stats.goal", { goal: settings.dailyGoal })}
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
                {t("stats.focused", {
                  minutes: formatMinutes(
                    data.todayMinutes,
                    t("settings.minutesShortUnit"),
                    t("settings.hoursShortUnit"),
                  ),
                })}
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
                {t("stats.dayStreak", { count: data.streak })}
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
              hitSlop={6}
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
                  ? t("stats.periodToday")
                  : p === "week"
                    ? t("stats.periodWeek")
                    : p === "month"
                      ? t("stats.periodMonth")
                      : t("stats.periodAll")}
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
          {periodTitle}
        </Text>
        <View style={styles.chart}>
          <Svg
            width="100%"
            height={lineChart.height + lineChart.labelHeight}
            viewBox={`0 0 ${lineChart.width} ${lineChart.height + lineChart.labelHeight}`}
          >
            <Rect
              x={0}
              y={0}
              width={lineChart.width}
              height={lineChart.height}
              rx={14}
              fill={colors.primary + "14"}
            />
            <Line
              x1={16}
              y1={lineChart.height - 16}
              x2={lineChart.width - 16}
              y2={lineChart.height - 16}
              stroke={colors.border}
              strokeWidth={1}
            />
            {lineChart.points.slice(0, -1).map((point, i) => {
              const next = lineChart.points[i + 1];
              return (
                <Line
                  key={`line-${i}`}
                  x1={point.x}
                  y1={point.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={colors.primary}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
            {lineChart.points.map((d, i) => {
              const isToday =
                period !== "all" && i === data.chartBuckets.length - 1;
              const pointColor =
                isToday || d.goalMet ? colors.primary : colors.accent;
              const pointOpacity = !isToday && !d.goalMet ? 0.55 : 1;
              return (
                <React.Fragment key={`point-${i}`}>
                  <SvgText
                    x={d.x}
                    y={Math.max(12, d.y - 12)}
                    fill={colors.mutedForeground}
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {d.minutes}
                  </SvgText>
                  <Circle
                    cx={d.x}
                    cy={d.y}
                    r={7}
                    fill={pointColor}
                    fillOpacity={pointOpacity}
                    stroke={colors.card}
                    strokeWidth={3}
                  />
                  <SvgText
                    x={d.x}
                    y={lineChart.height + 18}
                    fill={isToday ? colors.foreground : colors.mutedForeground}
                    fontSize={11}
                    fontWeight={isToday ? "700" : "500"}
                    textAnchor="middle"
                  >
                    {d.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
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
            {t("stats.totalSessions")}
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
            {t("stats.totalFocus")}
          </Text>
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {formatMinutes(
              data.allTimeMinutes,
              t("settings.minutesShortUnit"),
              t("settings.hoursShortUnit"),
            )}
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
          {t("stats.recent", { period })}
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
                ? t("stats.noSessionsToday")
                : t("stats.noSessionsPeriod")}
            </Text>
            <Pressable
              onPress={() => goTo("index")}
              style={({ pressed }) => [
                styles.emptyCta,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("stats.openTimer")}
            >
              <Text style={[styles.emptyCtaText, { color: colors.primaryForeground }]}>
                {t("stats.openTimer")}
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
                ? t("session.work")
                : s.type === "shortBreak"
                  ? t("session.shortBreak")
                  : t("session.longBreak"));
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
                    {time} • {Math.round(s.durationMs / 60000)}
                    {t("settings.minutesShortUnit")}
                  </Text>
                </View>
                {s.type === "work" && s.taskLabel ? (
                  <Pressable
                    onPress={() => handleResume(s.taskLabel)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t("stats.resumeTask")} ${s.taskLabel}`}
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
                      {t("timer.resume")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
        {hasMore ? (
          <Pressable
            onPress={() => setVisibleCount((n) => n + PAGE_SIZE)}
            accessibilityRole="button"
            accessibilityLabel={t("stats.showMore", { count: filtered.length - visibleCount })}
            style={({ pressed }) => [
              styles.showMore,
              {
                borderTopColor: colors.border,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.showMoreText, { color: colors.primary }]}>
              {t("stats.showMore", { count: filtered.length - visibleCount })}
            </Text>
          </Pressable>
        ) : null}
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
            {t("stats.setDailyGoal")}
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
    height: 130,
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
  showMore: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  showMoreText: {
    fontSize: 13,
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
