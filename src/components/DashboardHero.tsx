import Link from "next/link";
import { ChevronRight, Flame, Utensils } from "lucide-react";
import { MacroRing, MacroBar } from "./macros";

type Macros = { calories: number; protein: number; carbs: number; fat: number };
type Targets = { calories: number; proteinG: number; carbsG: number; fatG: number } | null;

/*
 * Compact "today strip" (plan §4, Home): one tappable summary card → /track.
 * The old Log Meal / Log Workout action cards are gone — the tab bar's Log
 * sheet owns quick actions now. Uses the shared MacroRing/MacroBar so there's
 * a single ring implementation.
 */
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
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-black tracking-tight">Welcome back, {name.split(" ")[0]}</h1>

      <Link
        href="/track"
        className="group block rounded-xl border border-border bg-surface-2 p-4 transition hover:border-accent/50"
      >
        {targets ? (
          <div className="flex items-center gap-4">
            <MacroRing consumed={consumed.calories} target={targets.calories} size={88} />
            <div className="min-w-0 flex-1 space-y-2">
              <MacroBar label="Protein" consumed={consumed.protein} target={targets.proteinG} color="var(--color-protein)" />
              <MacroBar label="Carbs" consumed={consumed.carbs} target={targets.carbsG} color="var(--color-carbs)" />
              <MacroBar label="Fat" consumed={consumed.fat} target={targets.fatG} color="var(--color-fat)" />
            </div>
            <ChevronRight size={16} className="shrink-0 text-text-tertiary transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </div>
        ) : (
          <p className="py-3 text-center text-xs text-text-tertiary">
            Set your goals to see your daily macro targets here.
          </p>
        )}
        <div className="mt-3 flex gap-4 border-t border-border pt-2.5 text-xs font-semibold text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Flame size={14} className={streak > 0 ? "text-carbs" : "text-text-tertiary"} fill={streak > 0 ? "currentColor" : "none"} />
            <span className="tabular-nums">{streak}</span> day streak
          </span>
          <span className="flex items-center gap-1.5">
            <Utensils size={14} className="text-text-tertiary" />
            <span className="tabular-nums">{mealsLogged}</span> logged today
          </span>
        </div>
      </Link>
    </div>
  );
}
