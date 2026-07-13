"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { useEffect } from "react";
import { logoutMacroTray } from "@/actions/macrotray";

export function MacroTrayNav({ connected }: { connected: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    const hideOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && navigator.userAgent.includes("MacroTray/")) {
        window.location.assign("https://macrotray.invalid/hide");
      }
    };
    window.addEventListener("keydown", hideOnEscape);
    return () => window.removeEventListener("keydown", hideOnEscape);
  }, []);
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {pathname !== "/macrotray" && <Link href="/macrotray" aria-label="Back to MacroTray" className="rounded-lg p-2 text-ink-dim hover:bg-card hover:text-ink"><ArrowLeft size={17} /></Link>}
          <Link href="/macrotray" className="truncate text-sm font-black">Macro<span className="text-accent">Tray</span></Link>
        </div>
        {connected && <form action={logoutMacroTray}><button className="rounded-lg p-2 text-ink-faint hover:bg-card hover:text-danger" aria-label="Disconnect MacroTray"><LogOut size={16} /></button></form>}
      </div>
    </header>
  );
}
