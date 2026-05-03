import { useColorScheme } from "react-native";

import colors, { type Palette, type ThemeName } from "@/constants/colors";
import { useSettings } from "@/contexts/AppContext";

export function useColors(): Palette & { radius: number } {
  const scheme = useColorScheme();
  const { settings } = useSettings();
  const themeName: ThemeName = settings.themeName;
  const theme = colors.themes[themeName] ?? colors.themes.crimson;
  const palette = scheme === "dark" ? theme.dark : theme.light;
  return { ...palette, radius: colors.radius };
}

export function useFallbackColors(): Palette & { radius: number } {
  const scheme = useColorScheme();
  const theme = colors.themes.crimson;
  const palette = scheme === "dark" ? theme.dark : theme.light;
  return { ...palette, radius: colors.radius };
}
