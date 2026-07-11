"use client";

import { useActionState, useMemo, useState } from "react";
import { createMealPrepPlan } from "@/actions/mealPreps";
import { round1 } from "@/lib/utils";
import { inputCls, btnPrimary, btnGhost } from "./ui";
import { CoverPhotoInput } from "./CoverPhotoInput";

export type RecipeOption = {
  id: string;
  name: string;
  calories: number;
  proteinG: number;
  costCents: number | null;
};

type Row = { recipeName: string; servings: string };

export function MealPrepForm({ recipeOptions }: { recipeOptions: RecipeOption[] }) {
  const [rows, setRows] = useState<Row[]>([{ recipeName: "", servings: "5" }]);
  const [state, action, pending] = useActionState(createMealPrepPlan, undefined);
  const byName = useMemo(() => new Map(recipeOptions.map((r) => [r.name.toLowerCase(), r])), [recipeOptions]);

  const resolved = rows.map((r) => ({
    ...r,
    recipe: byName.get(r.recipeName.trim().toLowerCase()) ?? null,
    n: parseFloat(r.servings) || 0,
  }));
  const items = resolved
    .filter((r) => r.recipe && r.n > 0)
    .map((r) => ({ recipeId: r.recipe!.id, servings: r.n }));
  const totalServings = items.reduce((a, i) => a + i.servings, 0);
  const totals = resolved.reduce(
    (acc, r) => {
      if (r.recipe && r.n > 0) {
        acc.calories += r.recipe.calories * r.n;
        acc.proteinG += r.recipe.proteinG * r.n;
        acc.costCents += (r.recipe.costCents ?? 0) * r.n;
      }
      return acc;
    },
    { calories: 0, proteinG: 0, costCents: 0 },
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <CoverPhotoInput />
      <input name="title" required minLength={3} maxLength={80} placeholder="Plan name (e.g. Cutting Week — 5 days)" className={inputCls} />
      <textarea name="description" maxLength={500} rows={2} placeholder="Who is this for? (optional)" className={`${inputCls} resize-none`} />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[10px] text-ink-dim">
          Days covered
          <input type="number" name="daysCovered" min={1} max={14} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Storage notes
          <input name="storageNotes" maxLength={300} placeholder="Fridge 4 days, freeze the rest" className={inputCls} />
        </label>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-dim">Recipes in this plan</h2>
        <datalist id="recipe-options">
          {recipeOptions.map((r) => (
            <option key={r.id} value={r.name} />
          ))}
        </datalist>
        {rows.map((row, i) => {
          const r = resolved[i];
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                list="recipe-options"
                value={row.recipeName}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, recipeName: e.target.value } : x)))}
                placeholder="Recipe (from the community library)"
                className={inputCls}
              />
              <input
                type="number"
                value={row.servings}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, servings: e.target.value } : x)))}
                min={0.5}
                step={0.5}
                className={`${inputCls} w-20 text-center`}
                aria-label="Servings"
              />
              <span className={`w-4 text-center text-sm ${r.recipe ? "text-accent" : "text-ink-faint"}`}>
                {r.recipe ? "✓" : "–"}
              </span>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-ink-faint hover:text-danger"
                aria-label="Remove recipe"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button type="button" onClick={() => setRows([...rows, { recipeName: "", servings: "5" }])} className={btnGhost}>
          + Add recipe
        </button>
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-3 text-sm">
          <span className="font-semibold text-accent">{Math.round(totalServings)} servings</span>
          <span className="text-ink-dim">
            {" "}
            · {round1(totals.calories / Math.max(1, totalServings))} kcal ·{" "}
            {round1(totals.proteinG / Math.max(1, totalServings))}g P per serving
            {totals.costCents > 0 && ` · ~$${(totals.costCents / Math.max(1, totalServings) / 100).toFixed(2)}/serving`}
          </span>
        </div>
      )}

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || items.length === 0} className={`${btnPrimary} w-full`}>
        {pending ? "Publishing…" : "Publish meal prep plan"}
      </button>
    </form>
  );
}
