import { Platform } from "react-native";

export type FloatingPillSessionLabel = string;

export interface FloatingPillState {
  label: FloatingPillSessionLabel;
  time: string;
  task: string;
  running: boolean;
  color: string;
}

export type FloatingPillEvent = "onToggle" | "onOpen";

interface NativeFloatingPillModule {
  isSupported(): boolean;
  hasOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  show(state: FloatingPillState): Promise<void>;
  update(state: FloatingPillState): Promise<void>;
  hide(): Promise<void>;
  addListener(event: FloatingPillEvent): void;
  removeListeners(count: number): void;
}

interface NativeSubscription {
  remove(): void;
}

let native: NativeFloatingPillModule | null = null;
type ExpoModule = {
  requireOptionalNativeModule?: <T>(name: string) => T | null;
  requireNativeModule?: <T>(name: string) => T;
  EventEmitter?: new (mod: unknown) => {
    addListener: (
      ev: string,
      fn: (...args: unknown[]) => void,
    ) => NativeSubscription;
  };
};
let EventEmitterCtor: ExpoModule["EventEmitter"] | null = null;
let emitter: InstanceType<NonNullable<ExpoModule["EventEmitter"]>> | null = null;

if (Platform.OS === "android") {
  try {
    // Loaded only inside a custom dev/release build that includes the
    // local `floating-pill` Expo module. In Expo Go this throws and we
    // fall back to a no-op implementation.
    const expo = require("expo") as ExpoModule;
    EventEmitterCtor = expo.EventEmitter ?? null;
    if (typeof expo.requireOptionalNativeModule === "function") {
      native = expo.requireOptionalNativeModule<NativeFloatingPillModule>(
        "FloatingPill",
      );
    } else if (typeof expo.requireNativeModule === "function") {
      native = expo.requireNativeModule<NativeFloatingPillModule>(
        "FloatingPill",
      );
    }
  } catch {
    native = null;
  }
}

function getEmitter() {
  if (!native || !EventEmitterCtor) return null;
  if (!emitter) emitter = new EventEmitterCtor(native);
  return emitter;
}

export const FloatingPill = {
  /**
   * True only inside a custom dev/release build on Android — Expo Go cannot
   * load the native overlay module.
   */
  isAvailable(): boolean {
    return native !== null;
  },
  isSupported(): boolean {
    if (!native) return false;
    try {
      return native.isSupported();
    } catch {
      return false;
    }
  },
  async hasOverlayPermission(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.hasOverlayPermission();
    } catch {
      return false;
    }
  },
  /**
   * Opens the system "Display over other apps" settings page. Returns true
   * if permission is already granted; otherwise false (user must grant in
   * Settings and the caller should re-check on next app foreground).
   */
  async requestOverlayPermission(): Promise<boolean> {
    if (!native) return false;
    try {
      return await native.requestOverlayPermission();
    } catch {
      return false;
    }
  },
  async show(state: FloatingPillState): Promise<void> {
    if (!native) return;
    try {
      await native.show(state);
    } catch {
      // ignore
    }
  },
  async update(state: FloatingPillState): Promise<void> {
    if (!native) return;
    try {
      await native.update(state);
    } catch {
      // ignore
    }
  },
  async hide(): Promise<void> {
    if (!native) return;
    try {
      await native.hide();
    } catch {
      // ignore
    }
  },
  addListener(
    event: FloatingPillEvent,
    handler: () => void,
  ): { remove: () => void } {
    const em = getEmitter();
    if (!em) return { remove: () => {} };
    const sub = em.addListener(event, handler);
    return { remove: () => sub.remove() };
  },
};

export default FloatingPill;
