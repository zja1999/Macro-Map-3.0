"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  Copy,
  Dumbbell,
  ListChecks,
  MapPin,
  Plus,
  RotateCcw,
  Scale,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Sheet } from "@/components/overlays";
import { quickAdd, copyPreviousDay } from "@/actions/logging";
import { round1 } from "@/lib/utils";

/*
 * The Log action sheet (plan §2.2): the center + opens a categorized
 * "add something" menu — everything here logs or records, so it reads as one
 * family of actions. Tracking-style-aware: habit/no-scale users get Habits in
 * the primary grid instead of Weight; calorie-only users get a quick-calories
 * shortcut.
 */

export type Frequent = { name: string; calories: number; proteinG: number; carbsG: number; fatG: number };

export type LogSheetData = {
  trackingStyle: string | null;
  frequents: Frequent[];
  /** Today's date (YYYY-MM-DD) + best-guess meal slot, computed server-side. */
  today: string;
  slot: string;
};

type GridAction = { href: string; label: string; sub: string; icon: LucideIcon };

export function LogSheet({ data }: { data: LogSheetData }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  // Server-action forms (copy yesterday, frequents) redirect to /track when
  // they finish — close the sheet when that navigation lands.
  useEffect(() => setOpen(false), [pathname]);

  const habitStyle = data.trackingStyle === "habit" || data.trackingStyle === "no_scale";

  const grid: GridAction[] = [
    { href: "/track/add", label: "Meal", sub: "Search or scan a food", icon: UtensilsCrossed },
    { href: "/restaurants", label: "Restaurant", sub: "Menu items near you", icon: MapPin },
    { href: "/workouts/log", label: "Workout", sub: "Log a session", icon: Dumbbell },
    habitStyle
      ? { href: "/progress", label: "Habits", sub: "Check in for today", icon: ListChecks }
      : { href: "/progress", label: "Weigh-in", sub: "Record today's weight", icon: Scale },
  ];

  const secondary: GridAction[] = [
    { href: "/progress", label: "Progress photo", sub: "", icon: Camera },
    data.trackingStyle === "calorie_only"
      ? { href: "/track/add", label: "Quick calories", sub: "", icon: Zap }
      : habitStyle
        ? { href: "/progress", label: "Weigh-in", sub: "", icon: Scale }
        : { href: "/progress", label: "Habit check-in", sub: "", icon: ListChecks },
  ];

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Add something"
      trigger={
        <button
          type="button"
          aria-label="Log"
          className="flex items-center px-3"
        >
          <span className="flex h-11 w-11 -translate-y-3 items-center justify-center rounded-full bg-accent text-black shadow-lg shadow-accent/30 transition active:scale-95">
            <Plus size={24} strokeWidth={2.5} />
          </span>
        </button>
      }
    >
      <div className="space-y-4">
        {/* primary: big navigational targets */}
        <div className="grid grid-cols-2 gap-3">
          {grid.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              onClick={close}
              className="group rounded-xl border border-border bg-surface-2 p-4 transition hover:border-accent/50 active:scale-[0.98]"
            >
              <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent ring-1 ring-accent/30">
                <a.icon size={20} strokeWidth={2} />
              </span>
              <span className="block text-sm font-bold">{a.label}</span>
              <span className="mt-0.5 block text-xs text-text-secondary">{a.sub}</span>
            </Link>
          ))}
        </div>

        {/* secondary */}
        <div className="grid grid-cols-2 gap-3">
          {secondary.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              onClick={close}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-1 px-3.5 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-text active:scale-[0.98]"
            >
              <a.icon size={17} strokeWidth={2} className="shrink-0" />
              {a.label}
            </Link>
          ))}
        </div>

        {/* shortcuts: copy yesterday + frequent re-logs */}
        <div className="border-t border-border pt-3">
          <div className="text-micro mb-2 text-text-tertiary">Shortcuts</div>
          <div className="flex flex-wrap gap-1.5">
            <form action={copyPreviousDay}>
              <input type="hidden" name="logDate" value={data.today} />
              <button className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-accent hover:text-accent">
                <Copy size={13} /> Copy yesterday
              </button>
            </form>
            {data.frequents.slice(0, 3).map((f) => (
              <form key={f.name} action={quickAdd}>
                <input type="hidden" name="logDate" value={data.today} />
                <input type="hidden" name="mealSlot" value={data.slot} />
                <input type="hidden" name="name" value={f.name.slice(0, 80)} />
                <input type="hidden" name="calories" value={round1(f.calories)} />
                <input type="hidden" name="proteinG" value={round1(f.proteinG)} />
                <input type="hidden" name="carbsG" value={round1(f.carbsG)} />
                <input type="hidden" name="fatG" value={round1(f.fatG)} />
                <button
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-text-secondary transition hover:border-accent hover:text-accent"
                  title={`${Math.round(f.calories)} kcal · ${Math.round(f.proteinG)}g protein`}
                >
                  <RotateCcw size={13} />
                  {f.name.length > 24 ? `${f.name.slice(0, 24)}…` : f.name}
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
