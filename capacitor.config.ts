import type { CapacitorConfig } from "@capacitor/cli";
import { KeyboardResize } from "@capacitor/keyboard";

/**
 * MacroVerse ships as a Capacitor remote-URL app (see docs/platform-and-integrations.md): the native
 * shell is a thin frame whose webview loads the live Next.js site over HTTPS, so a
 * Vercel deploy updates the app instantly with no store review. We do NOT static-
 * export — RSC/Server Actions/middleware all run server-side and must.
 *
 * `server.url` defaults to production. For live-reload development against a dev
 * server on the same Wi-Fi, set CAP_SERVER_URL to your machine's LAN address, e.g.
 *   CAP_SERVER_URL=http://192.168.1.20:3000 npx cap run android
 * An http:// URL flips cleartext on automatically so the webview will load it.
 */
const serverUrl = process.env.CAP_SERVER_URL || "https://macroverse.vercel.app";
const isCleartext = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.macroverse.app",
  appName: "MacroVerse",
  // Bundled fallback assets (offline/retry page). Content normally loads from
  // server.url; this folder just satisfies Capacitor and backstops a dead network.
  webDir: "capacitor/www",
  // A UA token so the server can adapt UI for the wrapped app (hide PWA install
  // prompts, enable native-only affordances) — see src/lib/native.ts isNativeUA().
  appendUserAgent: "MacroVerseApp",
  server: {
    url: serverUrl,
    cleartext: isCleartext,
    androidScheme: "https",
  },
  android: {
    // Keep the webview background dark so there's no white flash before first paint.
    backgroundColor: "#0a0a0b",
  },
  plugins: {
    SplashScreen: {
      // Auto-hide on a timer so a slow/unreachable remote can never leave the
      // splash stuck. NativeInit also calls hide() for a faster dismiss once the
      // deployed site initializes NativeInit — whichever fires first wins.
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: "#0a0a0b",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    Keyboard: {
      resize: KeyboardResize.Native, // webview resizes to the visible area above the keyboard
    },
  },
};

export default config;
