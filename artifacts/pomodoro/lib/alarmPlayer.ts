import { Platform } from "react-native";

import {
  ALARM_AUDIO_AVAILABLE,
  getAlarmSound,
  type AlarmSoundName,
} from "./alarmSounds";

type AudioModule = typeof import("expo-audio");

let audioModulePromise: Promise<AudioModule | null> | null = null;
let audioModeConfigured = false;

function loadAudioModule(): Promise<AudioModule | null> {
  if (!ALARM_AUDIO_AVAILABLE) return Promise.resolve(null);
  if (!audioModulePromise) {
    audioModulePromise = import("expo-audio")
      .then((m) => m as AudioModule)
      .catch(() => null);
  }
  return audioModulePromise;
}

async function ensureAudioMode(audio: AudioModule) {
  if (audioModeConfigured) return;
  audioModeConfigured = true;
  try {
    await audio.setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "mixWithOthers",
      shouldRouteThroughEarpiece: false,
    });
  } catch {
    // ignore
  }
}

const players = new Map<AlarmSoundName, ReturnType<AudioModule["createAudioPlayer"]>>();

function getOrCreatePlayer(audio: AudioModule, name: AlarmSoundName) {
  let player = players.get(name);
  if (player) return player;
  const sound = getAlarmSound(name);
  if (sound.module == null) return null;
  player = audio.createAudioPlayer(sound.module);
  players.set(name, player);
  return player;
}

export async function playAlarmSound(
  name: AlarmSoundName,
  volume: number,
): Promise<void> {
  if (Platform.OS === "web") return;
  const audio = await loadAudioModule();
  if (!audio) return;
  try {
    await ensureAudioMode(audio);
    const player = getOrCreatePlayer(audio, name);
    if (!player) return;
    const v = Math.max(0, Math.min(1, volume));
    try {
      player.volume = v;
    } catch {
      // ignore
    }
    try {
      player.seekTo(0);
    } catch {
      // ignore
    }
    player.play();
  } catch {
    // ignore — best effort
  }
}

export function unloadAlarmPlayers(): void {
  for (const player of players.values()) {
    try {
      player.remove();
    } catch {
      // ignore
    }
  }
  players.clear();
}
