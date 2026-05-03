import { Platform } from "react-native";

export type AlarmSoundName =
  | "bell"
  | "chime"
  | "digital"
  | "gentleWake"
  | "woodBlock";

export interface AlarmSound {
  name: AlarmSoundName;
  label: string;
  description: string;
  module: number | null;
}

const bellSrc = require("../assets/sounds/bell.wav");
const chimeSrc = require("../assets/sounds/chime.wav");
const digitalSrc = require("../assets/sounds/digital.wav");
const gentleWakeSrc = require("../assets/sounds/gentle-wake.wav");
const woodBlockSrc = require("../assets/sounds/wood-block.wav");

export const ALARM_SOUNDS: AlarmSound[] = [
  {
    name: "bell",
    label: "Bell",
    description: "Resonant bell with long ring-out",
    module: bellSrc,
  },
  {
    name: "chime",
    label: "Chime",
    description: "Three-note ascending chime",
    module: chimeSrc,
  },
  {
    name: "digital",
    label: "Digital",
    description: "Crisp triple beep",
    module: digitalSrc,
  },
  {
    name: "gentleWake",
    label: "Gentle Wake",
    description: "Soft chord that fades in and out",
    module: gentleWakeSrc,
  },
  {
    name: "woodBlock",
    label: "Wood Block",
    description: "Quick warm wooden taps",
    module: woodBlockSrc,
  },
];

export const DEFAULT_ALARM_SOUND: AlarmSoundName = "bell";

export function getAlarmSound(name: AlarmSoundName): AlarmSound {
  return ALARM_SOUNDS.find((s) => s.name === name) ?? ALARM_SOUNDS[0];
}

export const ALARM_AUDIO_AVAILABLE = Platform.OS !== "web";
