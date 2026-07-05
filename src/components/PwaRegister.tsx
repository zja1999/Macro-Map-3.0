"use client";

import { useEffect } from "react";

/** Registers the offline-shell service worker (public/sw.js). Production only —
 *  a SW caching dev-server pages makes HMR debugging miserable. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is progressive enhancement — never block the app on it */
    });
  }, []);
  return null;
}
