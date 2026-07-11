import { Capacitor } from "@capacitor/core";

/**
 * Thin shim over Capacitor so the rest of the app never imports it directly and
 * every call is SSR-safe. In remote-URL mode the same web bundle runs in a plain
 * browser AND inside the native shell — these helpers are how a component tells
 * which, without a `typeof window` dance at every call site.
 */

/** True only inside the Capacitor native shell (iOS/Android), false in any browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** "ios" | "android" | "web" — safe to call during SSR (returns "web"). */
export function getPlatform(): "ios" | "android" | "web" {
  const p = Capacitor.getPlatform();
  return p === "ios" || p === "android" ? p : "web";
}

/**
 * UA token appended by the native shell (capacitor.config.ts `appendUserAgent`).
 * Server code can't call isNative() — it has no Capacitor — so it sniffs this on
 * the request UA instead to adapt SSR output (e.g. hide the PWA install prompt).
 */
export const NATIVE_UA_TOKEN = "MacroVerseApp";

/** Server-side native detection from a request User-Agent string. Pure — pass it
 *  `(await headers()).get("user-agent")` from a Server Component / action. */
export function isNativeUA(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(NATIVE_UA_TOKEN);
}
