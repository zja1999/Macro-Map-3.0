"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { canOfferMacroTrayDownload } from "@/lib/macrotrayDownload";

const DISMISS_KEY = "macrotray-download-dismissed-at";

export function MacroTrayDownloadBanner() {
  const downloadUrl = process.env.NEXT_PUBLIC_MACROTRAY_DOWNLOAD_URL;
  const testingBuild = process.env.NEXT_PUBLIC_MACROTRAY_TESTING_BUILD === "true";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!downloadUrl) return;
    const ua = navigator.userAgent;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (canOfferMacroTrayDownload({ userAgent: ua, maxTouchPoints: navigator.maxTouchPoints, standalone, dismissedAt })) setVisible(true);
  }, [downloadUrl]);

  if (!visible || !downloadUrl) return null;
  const title = testingBuild ? "MacroTray for Windows — testing build" : "Log faster from Windows with MacroTray";
  const detail = testingBuild
    ? "Trusted tester preview. Windows may show an Unknown publisher warning; install only from MacroVerse."
    : "Meals, workouts, restaurants, weight, water, and habits from a compact tray panel.";
  const buttonLabel = testingBuild ? "Download testing build" : "Download for Windows";

  return <aside className="fixed inset-x-0 bottom-0 z-[70] hidden border-t border-accent/30 bg-card/95 px-4 py-2 shadow-2xl backdrop-blur md:block"><div className="mx-auto flex max-w-5xl items-center gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-bold">{title}</div><div className="text-[11px] text-ink-faint">{detail}</div></div><a href={downloadUrl} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black"><Download size={14}/>{buttonLabel}</a><button type="button" aria-label="Dismiss MacroTray download" onClick={() => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setVisible(false); }} className="rounded-lg p-2 text-ink-faint hover:bg-surface hover:text-ink"><X size={16}/></button></div></aside>;
}
