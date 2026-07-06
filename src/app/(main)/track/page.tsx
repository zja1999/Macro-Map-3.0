import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDayLogs, getWeekSummary } from "@/lib/queries";
import { todayStr, shiftDate, formatDateLabel, MEAL_SLOTS } from "@/lib/utils";
import { MacroRing, MacroBar } from "@/components/macros";
import { Card, btnGhost } from "@/components/ui";
import { deleteLog, copyPreviousDay, addWater } from "@/actions/logging";
import { NUTRIENT_DEFS, nutrientTotals } from "@/lib/nutrients";
import { FastingCard } from "@/components/FastingCard";
import { getFastingState } from "@/lib/queries";
import { formatWater, flOzToMl, type UnitsPref } from "@/lib/units";

export const metadata = { title: "Track" };

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayStr();
  const targets = user.targets;
  const units = user.profile.units as UnitsPref;
  // buttons add a round amount in the user's unit; stored value is always ml
  const waterSteps =
    units === "imperial"
      ? [
          { label: "+8 fl oz", ml: Math.round(flOzToMl(8)) },
          { label: "+16 fl oz", ml: Math.round(flOzToMl(16)) },
        ]
      : [
          { label: "+250ml", ml: 250 },
          { label: "+500ml", ml: 500 },
        ];

  const [{ logs, waterMl }, week, fasting] = await Promise.all([
    getDayLogs(user.id, date),
    getWeekSummary(user.id, date),
    getFastingState(user.id),
  ]);

  const totals = logs.reduce(
    (a, l) => ({
      calories: a.calories + l.calories,
      proteinG: a.proteinG + l.proteinG,
      carbsG: a.carbsG + l.carbsG,
      fatG: a.fatG + l.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const bySlot = Object.fromEntries(MEAL_SLOTS.map((s) => [s, logs.filter((l) => l.mealSlot === s)]));
  const { totals: micros, covered: microsCovered, missing: microsMissing } = nutrientTotals(logs);
  const weekAvg = week.length
    ? Math.round(week.reduce((a, d) => a + Number(d.calories), 0) / week.length)
    : 0;
  const daysOnTarget = targets
    ? week.filter((d) => Math.abs(Number(d.calories) - targets.calories) / targets.calories <= 0.1).length
    : 0;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* date scroller */}
      <div className="flex items-center justify-between">
        <Link href={`/track?date=${shiftDate(date, -1)}`} className={btnGhost} aria-label="Previous day">
          ←
        </Link>
        <h1 className="text-base font-bold">{formatDateLabel(date)}</h1>
        {date < todayStr() ? (
          <Link href={`/track?date=${shiftDate(date, 1)}`} className={btnGhost} aria-label="Next day">
            →
          </Link>
        ) : (
          <span className="w-[52px]" />
        )}
      </div>

      {/* summary */}
      <Card className="flex items-center gap-5 p-4">
        <MacroRing consumed={totals.calories} target={targets?.calories ?? 2000} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <MacroBar label="Protein" consumed={totals.proteinG} target={targets?.proteinG ?? 150} color="var(--color-protein)" />
          <MacroBar label="Carbs" consumed={totals.carbsG} target={targets?.carbsG ?? 200} color="var(--color-carbs)" />
          <MacroBar label="Fat" consumed={totals.fatG} target={targets?.fatG ?? 65} color="var(--color-fat)" />
        </div>
      </Card>

      {/* more nutrients (docs/10 §1) — collapsed so the 80/20 screen stays clean */}
      {logs.length > 0 && (
        <Card className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
              More nutrients
              <span className="text-xs text-ink-faint transition group-open:rotate-90">▸</span>
            </summary>
            <div className="border-t border-edge px-4 py-3">
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {NUTRIENT_DEFS.map((d) => {
                  if (!microsCovered[d.key]) {
                    return (
                      <li key={d.key} className="flex items-baseline justify-between text-xs">
                        <span className="text-ink-faint">{d.label}</span>
                        <span className="text-ink-faint" title="No logged item has data for this yet">—</span>
                      </li>
                    );
                  }
                  const v = Math.round(micros[d.key] * 10) / 10;
                  const pct = d.dv ? Math.round((micros[d.key] / d.dv) * 100) : null;
                  return (
                    <li key={d.key} className="flex items-baseline justify-between text-xs">
                      <span className="text-ink-dim">{d.label}</span>
                      <span className="tabular-nums">
                        {v}
                        <span className="text-ink-faint">{d.unit}</span>
                        {pct != null && <span className="ml-1 text-[10px] text-ink-faint">{pct}% DV</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {microsMissing > 0 && (
                <p className="mt-2 text-[10px] text-ink-faint">
                  {microsMissing} of {logs.length} logged item{logs.length === 1 ? "" : "s"} carr
                  {microsMissing === 1 ? "ies" : "y"} no detailed nutrition data — totals are a floor, not exact.
                </p>
              )}
            </div>
          </details>
        </Card>
      )}

      {/* fasting timer (docs/10 §3) — only rendered for today, where start/end make sense */}
      {date === todayStr() && <FastingCard active={fasting.active} lastCompleted={fasting.lastCompleted} />}

      {/* meals */}
      {MEAL_SLOTS.map((slot) => {
        const slotLogs = bySlot[slot];
        const slotKcal = slotLogs.reduce((a, l) => a + l.calories, 0);
        return (
          <Card key={slot} className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold capitalize">{slot}</h2>
              <div className="flex items-center gap-3">
                {slotKcal > 0 && <span className="text-xs tabular-nums text-ink-faint">{Math.round(slotKcal)} kcal</span>}
                <Link
                  href={`/track/add?date=${date}&slot=${slot}`}
                  className="rounded-md bg-accent/10 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/20"
                >
                  + Add
                </Link>
              </div>
            </div>
            {slotLogs.length === 0 ? (
              <p className="py-1 text-xs text-ink-faint">Nothing logged</p>
            ) : (
              <ul className="divide-y divide-edge">
                {slotLogs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm">
                        {l.recipeId ? (
                          <Link href={`/recipes/${l.recipeId}`} className="hover:text-accent">
                            🍳 {l.name}
                          </Link>
                        ) : (
                          l.name
                        )}
                        {l.servings !== 1 && <span className="text-ink-faint"> × {l.servings}</span>}
                      </div>
                      <div className="text-[11px] tabular-nums text-ink-faint">
                        {Math.round(l.calories)} kcal · {Math.round(l.proteinG)}P {Math.round(l.carbsG)}C {Math.round(l.fatG)}F
                      </div>
                    </div>
                    <form action={deleteLog}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="logDate" value={date} />
                      <button className="px-1 text-ink-faint hover:text-danger" aria-label="Remove">
                        ✕
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      {/* water + tools */}
      <Card className="flex items-center justify-between p-3">
        <div className="text-sm">
          💧 <span className="font-semibold tabular-nums">{formatWater(waterMl, units)}</span>
          <span className="text-xs text-ink-faint"> water</span>
        </div>
        <div className="flex gap-2">
          {waterSteps.map((step) => (
            <form key={step.label} action={addWater}>
              <input type="hidden" name="logDate" value={date} />
              <input type="hidden" name="ml" value={step.ml} />
              <button className="rounded-md bg-protein/10 px-2 py-1 text-xs font-medium text-protein hover:bg-protein/20">
                {step.label}
              </button>
            </form>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <form action={copyPreviousDay}>
          <input type="hidden" name="logDate" value={date} />
          <button className={btnGhost}>⧉ Copy yesterday</button>
        </form>
        <div className="text-right text-xs text-ink-faint">
          7-day avg: <span className="font-semibold text-ink-dim">{weekAvg} kcal</span>
          <br />
          on target {daysOnTarget}/7 days
        </div>
      </div>
    </div>
  );
}
