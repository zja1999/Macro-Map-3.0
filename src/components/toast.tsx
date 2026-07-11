"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { SHEET } from "@/lib/motion";

/*
 * Minimal app toast — the standard failure/undo surface for optimistic UI
 * (plan §3.6). Fire-and-forget from any client component:
 *   toast("Logged breakfast");
 *   toast("Couldn't save — try again", { tone: "error" });
 *   toast("Entry deleted", { action: { label: "Undo", onClick: restore } });
 * <Toaster /> is mounted once in the root layout.
 */

type ToastTone = "default" | "error";
type ToastAction = { label: string; onClick: () => void };
type ToastItem = { id: number; message: string; tone: ToastTone; action?: ToastAction };

let nextId = 1;
let push: ((t: ToastItem) => void) | null = null;

export function toast(message: string, opts?: { tone?: ToastTone; action?: ToastAction }) {
  push?.({ id: nextId++, message, tone: opts?.tone ?? "default", action: opts?.action });
}

const TOAST_MS = 5000;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    push = (t) => {
      setItems((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== t.id)), TOAST_MS);
    };
    return () => {
      push = null;
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] mb-safe flex flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={SHEET}
            className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm font-medium shadow-lg shadow-black/40"
          >
            {t.tone === "error" ? (
              <AlertCircle size={16} className="shrink-0 text-danger" />
            ) : (
              <CheckCircle2 size={16} className="shrink-0 text-positive" />
            )}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  setItems((prev) => prev.filter((i) => i.id !== t.id));
                }}
                className="shrink-0 font-semibold text-accent"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
