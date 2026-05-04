import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useSettings } from "@/contexts/AppContext";
import { useColors } from "@/hooks/useColors";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";
import { createTranslator } from "@/lib/i18n";

export default function TabLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const t = React.useMemo(
    () => createTranslator(settings.language),
    [settings.language],
  );
  const layout = useResponsiveLayout();
  const isDark =
    settings.colorScheme === "system"
      ? scheme === "dark"
      : settings.colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarShowLabel: layout.isTablet,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 0,
          elevation: 0,
          height: isWeb ? 84 : layout.isTablet ? 76 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card },
              ]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.timer"),
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="clock"
              size={focused ? 26 : 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("tabs.stats"),
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="bar-chart-2"
              size={focused ? 26 : 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, focused }) => (
            <Feather
              name="settings"
              size={focused ? 26 : 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
