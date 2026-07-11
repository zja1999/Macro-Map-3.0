"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNative, getPlatform } from "@/lib/native";
import { registerDeviceToken } from "@/actions/push";

/**
 * Native-shell bootstrap. Mounted once in the root layout;
 * a no-op in a plain browser. Sets up the chrome and platform behaviours a wrapped
 * app is expected to have:
 *   - dark status bar that matches the app background (no white system bar)
 *   - hides the splash screen once React has mounted (config keeps it up until now)
 *   - Android hardware back button walks web history, then backgrounds the app
 *   - deep links (App/Universal Links) route into the SPA instead of a cold load
 */
export function NativeInit() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;
    let cleanups: Array<() => void> = [];
    let cancelled = false;

    (async () => {
      const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/status-bar"),
        import("@capacitor/splash-screen"),
      ]);
      if (cancelled) return;

      // Dark background → light status-bar text. Solid bar (no overlay) so the
      // sticky app header never sits under the system clock.
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: "#0a0a0b" }).catch(() => {});

      // The site is interactive by the time this effect runs — drop the splash.
      SplashScreen.hide().catch(() => {});

      // Android hardware back: prefer in-app history, then background the app.
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) window.history.back();
        else App.exitApp();
      });
      cleanups.push(() => back.remove());

      // Deep link → push the path into the router so we transition, not reload.
      const open = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const { pathname, search, hash } = new URL(url);
          router.push(`${pathname}${search}${hash}` || "/");
        } catch {
          /* malformed deep link — ignore rather than crash the handler */
        }
      });
      cleanups.push(() => open.remove());

      // Push notifications are best-effort and fully optional: if the plugin
      // isn't in the native build yet, or the user denies permission, we just skip —
      // the app never depends on push. When granted, the FCM token is sent to the
      // server (registerDeviceToken) and taps deep-link via the payload's `href`.
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        if (cancelled) return;

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive === "granted") {
          const reg = await PushNotifications.addListener("registration", (token) => {
            registerDeviceToken({ token: token.value, platform: getPlatform() }).catch(() => {});
          });
          cleanups.push(() => reg.remove());

          const tapped = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const href = action.notification.data?.href;
            if (typeof href === "string" && href.startsWith("/")) router.push(href);
          });
          cleanups.push(() => tapped.remove());

          await PushNotifications.register();
        }
      } catch {
        /* push plugin absent or unavailable — silently continue */
      }
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      cleanups = [];
    };
  }, [router]);

  return null;
}
