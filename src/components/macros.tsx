"use client";

import { motion } from "motion/react";
import { Badge } from "./ui";
import { macroSourceLabel } from "@/lib/utils";
import { DRAW } from "@/lib/motion";

/** The one ring (plan §3.5): animated draw-in, over-target renders a second
 * lap in danger color on top of the completed first lap. */
export function MacroRing({
  consumed,
  target,
  size = 120,
}: {
  consumed: number;
  target: number;
  size?: number;
}) {
  const stroke = size >= 140 ? 11 : 9;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const ratio = target > 0 ? consumed / target : 0;
  const pct = Math.min(1, ratio);
  const overPct = Math.min(1, Math.max(0, ratio - 1));
  const over = consumed > target;
  const remaining = Math.round(target - consumed);
  const hero = size >= 140;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={DRAW}
        />
        {over && (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-danger)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - overPct) }}
            transition={{ ...DRAW, delay: 0.3 }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`${hero ? "text-display" : "text-xl font-bold"} ${over ? "text-danger" : ""}`}>
          {Math.abs(remaining)}
        </div>
        <div className="text-micro text-text-tertiary">{over ? "kcal over" : "kcal left"}</div>
      </div>
    </div>
  );
}

export function MacroBar({
  label,
  consumed,
  target,
  color,
}: {
  label: string;
  consumed: number;
  target: number;
  color: string;
}) {
  const pct = Math.min(100, target > 0 ? (consumed / target) * 100 : 0);
  const over = target > 0 && consumed > target;
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-text-secondary">{label}</span>
        <span className={`text-[11px] tabular-nums ${over ? "font-semibold text-danger" : "text-text-tertiary"}`}>
          {Math.round(consumed)}<span className="text-text-tertiary">/{target}g</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <motion.div
          className="h-full rounded-full"
          style={{ background: over ? "var(--color-danger)" : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={DRAW}
        />
      </div>
    </div>
  );
}

export function MacroPills({
  calories,
  proteinG,
  carbsG,
  fatG,
}: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium tabular-nums">
      <span className="rounded-md bg-surface-1 px-1.5 py-0.5 text-text">{Math.round(calories)} kcal</span>
      <span className="rounded-md bg-protein/10 px-1.5 py-0.5 text-protein">{Math.round(proteinG)}P</span>
      <span className="rounded-md bg-carbs/10 px-1.5 py-0.5 text-carbs">{Math.round(carbsG)}C</span>
      <span className="rounded-md bg-fat/10 px-1.5 py-0.5 text-fat">{Math.round(fatG)}F</span>
    </div>
  );
}

export function ProvenanceBadge({ source, confidence }: { source: string; confidence: number }) {
  const { label, tone } = macroSourceLabel(source);
  return (
    <span title={`Macro confidence ${(confidence * 100).toFixed(0)}%`}>
      <Badge tone={tone}>{tone === "good" ? "✓ " : "⚠ "}{label}</Badge>
    </span>
  );
}
