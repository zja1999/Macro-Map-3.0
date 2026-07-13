"use client";

/* "Build a bowl" configurator: stepper through option groups with a
 * live macro tally pinned at the bottom, checked against today's remaining targets.
 * Tap twice for a double portion where the group allows it. */
import { useActionState, useMemo, useState } from "react";
import { logBuild } from "@/actions/restaurants";
import { MEAL_SLOTS, round1 } from "@/lib/utils";
import { inputCls, btnPrimary, btnGhost } from "./ui";

type Option = {
  id: string;
  name: string;
  portionDesc: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isDefault: boolean;
};
type Group = { id: string; name: string; minChoices: number; maxChoices: number | null; options: Option[] };

export function BowlBuilder({
  menuItemId,
  itemName,
  chainName,
  groups,
  remaining,
  date,
  defaultSlot,
}: {
  menuItemId: string;
  itemName: string;
  chainName: string;
  groups: Group[];
  remaining: { calories: number; proteinG: number; logged: boolean } | null;
  date: string;
  defaultSlot: string;
}) {
  // option id → portion count; start from the chain's default build
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.options.filter((o) => o.isDefault).map((o) => [o.id, 1]))),
  );
  const [slot, setSlot] = useState(defaultSlot);
  const [orderName, setOrderName] = useState("");
  const [state, action, pending] = useActionState(logBuild, undefined);

  const groupTotal = (g: Group) => g.options.reduce((a, o) => a + (counts[o.id] ?? 0), 0);

  const tap = (g: Group, o: Option) => {
    const cur = counts[o.id] ?? 0;
    setCounts((prev) => {
      const next = { ...prev };
      if (g.maxChoices === 1) {
        // radio-style group: select exclusively, tap again to clear
        for (const opt of g.options) delete next[opt.id];
        if (cur === 0) next[o.id] = 1;
      } else if (cur === 0) {
        if (g.maxChoices != null && groupTotal(g) >= g.maxChoices) return prev; // group full
        next[o.id] = 1;
      } else if (g.maxChoices == null || groupTotal(g) < g.maxChoices) {
        if (cur >= 2) delete next[o.id]; // cycle 0 → 1 → 2 → 0
        else next[o.id] = cur + 1;
      } else {
        delete next[o.id];
      }
      return next;
    });
  };

  const tally = useMemo(() => {
    const t = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    for (const g of groups)
      for (const o of g.options) {
        const n = counts[o.id] ?? 0;
        t.calories += o.calories * n;
        t.proteinG += o.proteinG * n;
        t.carbsG += o.carbsG * n;
        t.fatG += o.fatG * n;
      }
    return t;
  }, [groups, counts]);

  const optionIds = useMemo(
    () => Object.entries(counts).flatMap(([id, n]) => Array(n).fill(id) as string[]),
    [counts],
  );
  const unmetGroups = groups.filter((g) => groupTotal(g) < g.minChoices);
  const overBudget = remaining?.logged && remaining.calories > 150 && tally.calories > remaining.calories;

  return (
    <form action={action} className="space-y-4 pb-36">
      <input type="hidden" name="menuItemId" value={menuItemId} />
      <input type="hidden" name="logDate" value={date} />
      <input type="hidden" name="mealSlot" value={slot} />
      <input type="hidden" name="optionIds" value={JSON.stringify(optionIds)} />

      {groups.map((g) => (
        <section key={g.id} className="rounded-xl border border-edge bg-card p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">{g.name}</h2>
            <span className="text-[10px] text-ink-faint">
              {g.maxChoices === 1
                ? "pick one"
                : g.maxChoices != null
                  ? `up to ${g.maxChoices}`
                  : "tap twice for double"}
              {g.minChoices > 0 && " · required"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {g.options.map((o) => {
              const n = counts[o.id] ?? 0;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => tap(g, o)}
                  className={`rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                    n > 0
                      ? "border-accent bg-accent/10 text-ink"
                      : "border-edge bg-surface text-ink-dim hover:border-ink-faint"
                  }`}
                >
                  <span className="flex items-center justify-between font-medium">
                    <span className="truncate">{o.name}</span>
                    {n > 1 && <span className="ml-1 shrink-0 font-bold text-accent">×{n}</span>}
                  </span>
                  <span className="mt-0.5 block tabular-nums text-[10px] text-ink-faint">
                    {Math.round(o.calories)} kcal · {Math.round(o.proteinG)}P
                    {o.portionDesc ? ` · ${o.portionDesc}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {/* save as go-to order */}
      <section className="rounded-xl border border-edge bg-card p-3">
        <h2 className="mb-2 text-sm font-semibold">Save as go-to order</h2>
        <div className="flex gap-2">
          <input
            name="orderName"
            value={orderName}
            onChange={(e) => setOrderName(e.target.value)}
            maxLength={60}
            placeholder={`e.g. My usual ${itemName.toLowerCase()}`}
            className={inputCls}
          />
          <button
            name="intent"
            value="save"
            disabled={pending || !orderName.trim() || optionIds.length === 0}
            className={btnGhost}
          >
            Save
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-ink-faint">
          Saved orders are re-loggable in one tap and show up as popular builds for others.
        </p>
      </section>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state && !state.error && <p className="text-sm font-semibold text-accent">Order saved.</p>}

      {/* live tally bar — pinned */}
      <div className="fixed inset-x-0 bottom-16 z-30 md:bottom-4">
        <div className="mx-auto max-w-xl px-4">
          <div
            className={`rounded-xl border p-3 shadow-lg backdrop-blur ${
              overBudget ? "border-carbs/50 bg-carbs/10" : "border-accent/40 bg-card/95"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-semibold tabular-nums">
                  <span>{Math.round(tally.calories)} kcal</span>
                  <span className="text-protein">{round1(tally.proteinG)}P</span>
                  <span className="text-carbs">{round1(tally.carbsG)}C</span>
                  <span className="text-fat">{round1(tally.fatG)}F</span>
                </div>
                <div className={`text-[10px] ${overBudget ? "text-carbs" : "text-ink-faint"}`}>
                  {remaining?.logged && remaining.calories > 150
                    ? overBudget
                      ? `${Math.round(tally.calories - remaining.calories)} kcal over your remaining budget`
                      : `${Math.round(remaining.calories - tally.calories)} kcal left after this · ${chainName}`
                    : `${chainName} — ${itemName}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <select
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="rounded-lg border border-edge bg-surface px-2 py-2 text-xs text-ink"
                  aria-label="Meal"
                >
                  {MEAL_SLOTS.map((s) => (
                    <option key={s} value={s} className="capitalize">
                      {s}
                    </option>
                  ))}
                </select>
                <button
                  name="intent"
                  value={orderName.trim() ? "log_save" : "log"}
                  disabled={pending || optionIds.length === 0 || unmetGroups.length > 0}
                  className={btnPrimary}
                  title={unmetGroups.length ? `Pick from: ${unmetGroups.map((g) => g.name).join(", ")}` : undefined}
                >
                  {pending ? "Logging…" : orderName.trim() ? "Log + save" : "Log it"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
