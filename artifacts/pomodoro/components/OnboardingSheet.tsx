import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApp } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { createTranslator } from "@/lib/i18n";

export function OnboardingSheet() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, setSettings, loaded } = useApp();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
  const rows: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
    {
      icon: "clock",
      title: t("onboarding.row1Title"),
      body: t("onboarding.row1Body"),
    },
    {
      icon: "bell",
      title: t("onboarding.row2Title"),
      body: t("onboarding.row2Body"),
    },
    {
      icon: "bar-chart-2",
      title: t("onboarding.row3Title"),
      body: t("onboarding.row3Body"),
    },
  ];

  const visible = loaded && !settings.onboardingCompleted;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={() => setSettings({ onboardingCompleted: true })}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.border }]}
          />
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t("onboarding.title")}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {t("onboarding.subtitle")}
          </Text>
          <View style={styles.rows}>
            {rows.map((r) => (
              <View key={r.title} style={styles.row}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: colors.primary + "1f" },
                  ]}
                >
                  <Feather name={r.icon} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.rowTitle, { color: colors.foreground }]}
                  >
                    {r.title}
                  </Text>
                  <Text
                    style={[
                      styles.rowBody,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {r.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Pressable
            onPress={() => setSettings({ onboardingCompleted: true })}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.getStarted")}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
              {t("onboarding.getStarted")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 14,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  rows: {
    gap: 18,
    marginTop: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  rowBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 3,
    lineHeight: 18,
  },
  cta: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
