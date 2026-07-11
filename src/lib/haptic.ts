import { Capacitor } from "@capacitor/core";

/**
 * One haptic entry point for the whole app (overhaul plan §3 Motion). Fires the
 * native Taptic/vibration motor inside the Capacitor shell, falls back to the Web
 * Vibration API in a browser (Android Chrome supports it; iOS Safari ignores it),
 * and no-ops everywhere else. Always fire-and-forget — never block UI on it, and
 * never let a missing plugin throw into a click handler.
 */
export type HapticKind = "light" | "medium" | "heavy" | "success" | "warning" | "error";

// Web Vibration fallback durations (ms), keyed to the same intents.
const WEB_PATTERN: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [30, 40, 30],
};

export function haptic(kind: HapticKind = "light"): void {
  void run(kind);
}

async function run(kind: HapticKind): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
      if (kind === "success" || kind === "warning" || kind === "error") {
        const type =
          kind === "success"
            ? NotificationType.Success
            : kind === "warning"
              ? NotificationType.Warning
              : NotificationType.Error;
        await Haptics.notification({ type });
      } else {
        const style =
          kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
      return;
    }
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(WEB_PATTERN[kind]);
    }
  } catch {
    /* haptics are a nicety — a missing motor or plugin must never break a tap */
  }
}
