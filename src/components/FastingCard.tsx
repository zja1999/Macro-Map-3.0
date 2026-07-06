"use client";

import { useEffect, useState } from "react";
import { startFast, endFast, discardFast } from "@/actions/fasting";
import { Card, inputCls } from "@/components/ui";

type Fast = { id: string; startedAt: Date; endedAt: Date | null; targetHours: number };

function fmtHm(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, "0")}m`;
}

export function FastingCard({ active, lastCompleted }: { active: Fast | null; lastCompleted: Fast | null }) {
  // elapsed is client-only (ticks every 30s); render a placeholder pre-hydration
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (active) {
    const elapsedMs = now != null ? now - new Date(active.startedAt).getTime() : null;
    const pct = elapsedMs != null ? Math.min(100, (elapsedMs / (active.targetHours * 3600_000)) * 100) : 0;
    const done = pct >= 100;
    return (
      <Card className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm">
              ⏳ <span className="font-semibold tabular-nums">{elapsedMs != null ? fmtHm(elapsedMs) : "…"}</span>
              <span className="text-xs text-ink-faint"> into your {active.targetHours}h fast</span>
              {done && <span className="ml-1 text-xs font-semibold text-accent">target hit ✓</span>}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full transition-all ${done ? "bg-accent" : "bg-carbs"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <form action={endFast}>
              <button className="rounded-md bg-accent/10 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/20">
                End fast
              </button>
            </form>
            <form action={discardFast}>
              <button className="px-1 text-ink-faint hover:text-danger" aria-label="Discard fast" title="Discard (started by mistake)">
                ✕
              </button>
            </form>
          </div>
        </div>
      </Card>
    );
  }

  const lastMs =
    lastCompleted?.endedAt != null
      ? new Date(lastCompleted.endedAt).getTime() - new Date(lastCompleted.startedAt).getTime()
      : null;
  return (
    <Card className="flex items-center justify-between gap-3 p-3">
      <div className="text-sm">
        ⏳ <span className="text-xs text-ink-faint">Fasting</span>
        {lastCompleted && lastMs != null && (
          <div className="text-[11px] tabular-nums text-ink-faint">
            last: {fmtHm(lastMs)}
            {lastMs >= lastCompleted.targetHours * 3600_000 ? " · hit " : " of "}
            {lastCompleted.targetHours}h{lastMs >= lastCompleted.targetHours * 3600_000 && " ✓"}
          </div>
        )}
      </div>
      <form action={startFast} className="flex items-center gap-1.5">
        <input
          type="number"
          name="targetHours"
          defaultValue={16}
          min={8}
          max={72}
          step={1}
          className={`${inputCls} w-16 px-2 py-1 text-center`}
          aria-label="Fast target hours"
        />
        <button className="rounded-md bg-carbs/10 px-2 py-1 text-xs font-medium text-carbs hover:bg-carbs/20">
          Start fast
        </button>
      </form>
    </Card>
  );
}
