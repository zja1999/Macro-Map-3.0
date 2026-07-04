import { Badge } from "./ui";
import { macroSourceLabel } from "@/lib/utils";

export function MacroRing({
  consumed,
  target,
  size = 120,
}: {
  consumed: number;
  target: number;
  size?: number;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, target > 0 ? consumed / target : 0);
  const over = consumed > target;
  const remaining = Math.round(target - consumed);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-edge)" strokeWidth={9} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? "var(--color-fat)" : "var(--color-accent)"}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-xl font-bold ${over ? "text-fat" : ""}`}>{Math.abs(remaining)}</div>
        <div className="text-[10px] uppercase tracking-wide text-ink-faint">
          {over ? "kcal over" : "kcal left"}
        </div>
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
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-ink-dim">{label}</span>
        <span className="text-[11px] tabular-nums text-ink-faint">
          {Math.round(consumed)}<span className="text-ink-faint">/{target}g</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-edge">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
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
      <span className="rounded-md bg-surface px-1.5 py-0.5 text-ink">{Math.round(calories)} kcal</span>
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
