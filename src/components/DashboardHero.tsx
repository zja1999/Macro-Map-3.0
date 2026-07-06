import Link from "next/link";
import { Card } from "./ui";

type Macros = { calories: number; protein: number; carbs: number; fat: number };
type Targets = { calories: number; proteinG: number; carbsG: number; fatG: number } | null;

function Ring({ pct, children }: { pct: number; children: React.ReactNode }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const dash = Math.min(1, Math.max(0, pct)) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-edge)" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">{children}</div>
    </div>
  );
}

function MacroBar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[11px] text-ink-faint">{label}</div>
      <div className="text-lg font-bold tabular-nums leading-tight">
        {Math.round(value)}
        <span className="text-xs font-medium text-ink-faint">g</span>
      </div>
      <div className="mb-0.5 text-[10px] text-ink-faint">of {target}g</div>
      <div className="h-1.5 overflow-hidden rounded-full bg-edge">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function DashboardHero({
  name,
  consumed,
  targets,
  streak,
  mealsLogged,
}: {
  name: string;
  consumed: Macros;
  targets: Targets;
  streak: number;
  mealsLogged: number;
}) {
  const kcalTarget = targets?.calories ?? 0;
  const remaining = Math.max(0, kcalTarget - Math.round(consumed.calories));
  const kcalPct = kcalTarget > 0 ? consumed.calories / kcalTarget : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight">
          Welcome back, {name.split(" ")[0]} <span className="align-middle">👋</span>
        </h1>
        <p className="text-sm text-ink-dim">You&apos;ve got this. Small choices, big results.</p>
      </div>

      {/* hero action cards */}
      <div className="grid grid-cols-2 gap-3">
        <ActionCard
          href="/track/add"
          icon="🍽️"
          title="Log Meal"
          sub="Quickly log meals & track macros"
        />
        <ActionCard
          href="/workouts/log"
          icon="🏋️"
          title="Log Workout"
          sub="Track workouts & stay consistent"
        />
      </div>

      {/* today's macros */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Today&apos;s Macros</h2>
          <Link href="/track" className="text-xs font-semibold text-accent hover:underline">
            Details ›
          </Link>
        </div>
        {targets ? (
          <div className="flex items-center gap-5">
            <Ring pct={kcalPct}>
              <span className="text-2xl font-black tabular-nums">{remaining}</span>
              <span className="text-[10px] text-ink-faint">of {kcalTarget}</span>
              <span className="text-[10px] text-ink-faint">kcal left</span>
            </Ring>
            <div className="flex min-w-0 flex-1 gap-4">
              <MacroBar label="Protein" value={consumed.protein} target={targets.proteinG} color="var(--color-protein)" />
              <MacroBar label="Carbs" value={consumed.carbs} target={targets.carbsG} color="var(--color-carbs)" />
              <MacroBar label="Fat" value={consumed.fat} target={targets.fatG} color="var(--color-fat)" />
            </div>
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-ink-faint">
            Set your goals to see your daily macro targets here.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-edge pt-3">
          <Stat icon="🔥" value={`${streak}`} label={`day streak`} />
          <Stat icon="🍴" value={`${mealsLogged}`} label="meals logged today" />
        </div>
      </Card>
    </div>
  );
}

function ActionCard({ href, icon, title, sub }: { href: string; icon: string; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-xl border border-edge bg-gradient-to-br from-card to-surface p-4 transition hover:border-accent/50"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-xl ring-1 ring-accent/30">
        {icon}
      </div>
      <div className="text-base font-bold">{title}</div>
      <div className="mt-0.5 text-xs text-ink-dim">{sub}</div>
      <span className="mt-3 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold text-black transition group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-base ring-1 ring-accent/25">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none tabular-nums">{value}</div>
        <div className="truncate text-[10px] text-ink-faint">{label}</div>
      </div>
    </div>
  );
}
