export type ThemeName = "crimson" | "ocean" | "forest" | "midnight" | "sunset";

export type AccentName =
  | "default"
  | "ruby"
  | "amber"
  | "emerald"
  | "sapphire"
  | "violet"
  | "rose";

export interface Accent {
  name: AccentName;
  label: string;
  light: string;
  dark: string;
}

export const accentList: Accent[] = [
  { name: "default", label: "Theme", light: "", dark: "" },
  { name: "ruby", label: "Ruby", light: "#d6294a", dark: "#ff5577" },
  { name: "amber", label: "Amber", light: "#d97706", dark: "#fbbf24" },
  { name: "emerald", label: "Emerald", light: "#059669", dark: "#34d399" },
  { name: "sapphire", label: "Sapphire", light: "#1d4ed8", dark: "#60a5fa" },
  { name: "violet", label: "Violet", light: "#7c3aed", dark: "#a78bfa" },
  { name: "rose", label: "Rose", light: "#e11d6f", dark: "#fb7299" },
];

export function resolveAccent(
  accent: AccentName,
  scheme: "light" | "dark",
): string | null {
  if (accent === "default") return null;
  const a = accentList.find((x) => x.name === accent);
  if (!a) return null;
  return scheme === "dark" ? a.dark : a.light;
}

export interface Palette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  workColor: string;
  shortBreakColor: string;
  longBreakColor: string;
  ringTrack: string;
  text: string;
  tint: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  light: Palette;
  dark: Palette;
}

const themes: Record<ThemeName, Theme> = {
  crimson: {
    name: "crimson",
    label: "Crimson",
    light: {
      background: "#fdf8f6",
      foreground: "#1c0f0c",
      card: "#ffffff",
      cardForeground: "#1c0f0c",
      primary: "#c8442a",
      primaryForeground: "#ffffff",
      secondary: "#f4e6e1",
      secondaryForeground: "#1c0f0c",
      muted: "#f4e6e1",
      mutedForeground: "#86635a",
      accent: "#f0c8b8",
      accentForeground: "#1c0f0c",
      destructive: "#c8442a",
      destructiveForeground: "#ffffff",
      border: "#ecd9d2",
      input: "#ecd9d2",
      workColor: "#c8442a",
      shortBreakColor: "#3a8a6a",
      longBreakColor: "#6b4ea8",
      ringTrack: "#f0e0d8",
      text: "#1c0f0c",
      tint: "#c8442a",
    },
    dark: {
      background: "#140907",
      foreground: "#fdf2ee",
      card: "#1f0f0c",
      cardForeground: "#fdf2ee",
      primary: "#ff6a47",
      primaryForeground: "#1a0a07",
      secondary: "#2a1612",
      secondaryForeground: "#fdf2ee",
      muted: "#2a1612",
      mutedForeground: "#a88478",
      accent: "#3a1f18",
      accentForeground: "#fdf2ee",
      destructive: "#ff6a47",
      destructiveForeground: "#1a0a07",
      border: "#2e1813",
      input: "#2e1813",
      workColor: "#ff6a47",
      shortBreakColor: "#52c294",
      longBreakColor: "#9d7ed1",
      ringTrack: "#2a1612",
      text: "#fdf2ee",
      tint: "#ff6a47",
    },
  },
  ocean: {
    name: "ocean",
    label: "Deep Ocean",
    light: {
      background: "#f4f9fb",
      foreground: "#0a1a23",
      card: "#ffffff",
      cardForeground: "#0a1a23",
      primary: "#0e6b8a",
      primaryForeground: "#ffffff",
      secondary: "#dceaf0",
      secondaryForeground: "#0a1a23",
      muted: "#dceaf0",
      mutedForeground: "#5b7986",
      accent: "#b8d8e3",
      accentForeground: "#0a1a23",
      destructive: "#d9534f",
      destructiveForeground: "#ffffff",
      border: "#cee0e8",
      input: "#cee0e8",
      workColor: "#0e6b8a",
      shortBreakColor: "#2aa39a",
      longBreakColor: "#4a6b8c",
      ringTrack: "#e0ecf2",
      text: "#0a1a23",
      tint: "#0e6b8a",
    },
    dark: {
      background: "#04121a",
      foreground: "#eaf5fa",
      card: "#0a1f2c",
      cardForeground: "#eaf5fa",
      primary: "#4dd4f0",
      primaryForeground: "#04121a",
      secondary: "#0f2838",
      secondaryForeground: "#eaf5fa",
      muted: "#0f2838",
      mutedForeground: "#7a98a8",
      accent: "#163a52",
      accentForeground: "#eaf5fa",
      destructive: "#ff6b6b",
      destructiveForeground: "#04121a",
      border: "#143245",
      input: "#143245",
      workColor: "#4dd4f0",
      shortBreakColor: "#5feac0",
      longBreakColor: "#7da8d4",
      ringTrack: "#0f2838",
      text: "#eaf5fa",
      tint: "#4dd4f0",
    },
  },
  forest: {
    name: "forest",
    label: "Forest",
    light: {
      background: "#f5f9f4",
      foreground: "#0f1d10",
      card: "#ffffff",
      cardForeground: "#0f1d10",
      primary: "#2d6a3e",
      primaryForeground: "#ffffff",
      secondary: "#dfeadc",
      secondaryForeground: "#0f1d10",
      muted: "#dfeadc",
      mutedForeground: "#5a7560",
      accent: "#bcd6bb",
      accentForeground: "#0f1d10",
      destructive: "#c64537",
      destructiveForeground: "#ffffff",
      border: "#d2e0cf",
      input: "#d2e0cf",
      workColor: "#2d6a3e",
      shortBreakColor: "#7a9c3a",
      longBreakColor: "#5b6b3a",
      ringTrack: "#e3ecdf",
      text: "#0f1d10",
      tint: "#2d6a3e",
    },
    dark: {
      background: "#06120a",
      foreground: "#eaf5e8",
      card: "#0d1f12",
      cardForeground: "#eaf5e8",
      primary: "#6cd28a",
      primaryForeground: "#06120a",
      secondary: "#13281a",
      secondaryForeground: "#eaf5e8",
      muted: "#13281a",
      mutedForeground: "#7a958a",
      accent: "#1c3826",
      accentForeground: "#eaf5e8",
      destructive: "#ff7a6b",
      destructiveForeground: "#06120a",
      border: "#1a3322",
      input: "#1a3322",
      workColor: "#6cd28a",
      shortBreakColor: "#c4d96a",
      longBreakColor: "#9ab47a",
      ringTrack: "#13281a",
      text: "#eaf5e8",
      tint: "#6cd28a",
    },
  },
  midnight: {
    name: "midnight",
    label: "Midnight",
    light: {
      background: "#f6f5fb",
      foreground: "#15102a",
      card: "#ffffff",
      cardForeground: "#15102a",
      primary: "#5b3fbf",
      primaryForeground: "#ffffff",
      secondary: "#e6e2f3",
      secondaryForeground: "#15102a",
      muted: "#e6e2f3",
      mutedForeground: "#6f6486",
      accent: "#c8bee8",
      accentForeground: "#15102a",
      destructive: "#d9415f",
      destructiveForeground: "#ffffff",
      border: "#d9d2eb",
      input: "#d9d2eb",
      workColor: "#5b3fbf",
      shortBreakColor: "#3f9bbf",
      longBreakColor: "#a13fbf",
      ringTrack: "#e8e3f3",
      text: "#15102a",
      tint: "#5b3fbf",
    },
    dark: {
      background: "#08061a",
      foreground: "#f0edff",
      card: "#100c2c",
      cardForeground: "#f0edff",
      primary: "#a78bfa",
      primaryForeground: "#08061a",
      secondary: "#1a1542",
      secondaryForeground: "#f0edff",
      muted: "#1a1542",
      mutedForeground: "#9088b8",
      accent: "#241b58",
      accentForeground: "#f0edff",
      destructive: "#ff5c7a",
      destructiveForeground: "#08061a",
      border: "#231a52",
      input: "#231a52",
      workColor: "#a78bfa",
      shortBreakColor: "#7ad6f5",
      longBreakColor: "#e08bfa",
      ringTrack: "#1a1542",
      text: "#f0edff",
      tint: "#a78bfa",
    },
  },
  sunset: {
    name: "sunset",
    label: "Sunset",
    light: {
      background: "#fff8f3",
      foreground: "#26120a",
      card: "#ffffff",
      cardForeground: "#26120a",
      primary: "#e0653a",
      primaryForeground: "#ffffff",
      secondary: "#fbe4d4",
      secondaryForeground: "#26120a",
      muted: "#fbe4d4",
      mutedForeground: "#8a6555",
      accent: "#f7c7a8",
      accentForeground: "#26120a",
      destructive: "#c8362e",
      destructiveForeground: "#ffffff",
      border: "#f3d7c1",
      input: "#f3d7c1",
      workColor: "#e0653a",
      shortBreakColor: "#e0a93a",
      longBreakColor: "#c8487f",
      ringTrack: "#fae3d3",
      text: "#26120a",
      tint: "#e0653a",
    },
    dark: {
      background: "#1a0a05",
      foreground: "#fff1e3",
      card: "#241208",
      cardForeground: "#fff1e3",
      primary: "#ff8a5b",
      primaryForeground: "#1a0a05",
      secondary: "#321a0e",
      secondaryForeground: "#fff1e3",
      muted: "#321a0e",
      mutedForeground: "#b08a78",
      accent: "#42220f",
      accentForeground: "#fff1e3",
      destructive: "#ff5c5c",
      destructiveForeground: "#1a0a05",
      border: "#3d1f0e",
      input: "#3d1f0e",
      workColor: "#ff8a5b",
      shortBreakColor: "#ffc26b",
      longBreakColor: "#ff7aa8",
      ringTrack: "#321a0e",
      text: "#fff1e3",
      tint: "#ff8a5b",
    },
  },
};

export const themeList: Theme[] = [
  themes.crimson,
  themes.ocean,
  themes.forest,
  themes.midnight,
  themes.sunset,
];

const colors = {
  light: themes.crimson.light,
  dark: themes.crimson.dark,
  radius: 18,
  themes,
};

export default colors;
