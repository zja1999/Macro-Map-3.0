"use client";

import { useActionState, useMemo, useState } from "react";
import { submitRecipe } from "@/actions/recipes";
import { RECIPE_TAGS, round1 } from "@/lib/utils";
import { inputCls, btnPrimary, btnGhost } from "./ui";

export type FoodOption = {
  id: string;
  name: string;
  servingGrams: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type IngredientRow = { rawText: string; foodName: string; grams: string };

export function RecipeForm({ foodOptions }: { foodOptions: FoodOption[] }) {
  const [rows, setRows] = useState<IngredientRow[]>([{ rawText: "", foodName: "", grams: "" }]);
  const [servings, setServings] = useState(4);
  const [tags, setTags] = useState<string[]>([]);
  const [state, action, pending] = useActionState(submitRecipe, undefined);

  const foodByName = useMemo(() => new Map(foodOptions.map((f) => [f.name.toLowerCase(), f])), [foodOptions]);

  const resolved = rows.map((r) => {
    const food = foodByName.get(r.foodName.trim().toLowerCase()) ?? null;
    const grams = parseFloat(r.grams) || null;
    return { ...r, food, grams };
  });
  const allLinked = resolved.length > 0 && resolved.every((r) => r.food && r.grams);

  const tally = resolved.reduce(
    (acc, r) => {
      if (r.food?.servingGrams && r.grams) {
        const f = r.grams / r.food.servingGrams;
        acc.calories += r.food.calories * f;
        acc.proteinG += r.food.proteinG * f;
        acc.carbsG += r.food.carbsG * f;
        acc.fatG += r.food.fatG * f;
      }
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const per = (n: number) => round1(n / Math.max(1, servings));

  const ingredientsPayload = JSON.stringify(
    resolved.map((r) => ({
      rawText: r.rawText || `${r.grams ?? ""}g ${r.foodName}`.trim(),
      foodId: r.food && r.grams ? r.food.id : null,
      grams: r.grams,
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="ingredients" value={ingredientsPayload} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-dim">Basics</h2>
        <input name="name" required minLength={3} maxLength={80} placeholder="Recipe name" className={inputCls} />
        <textarea name="description" maxLength={500} rows={2} placeholder="Short description (optional)" className={`${inputCls} resize-none`} />
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs text-ink-dim">
            Servings
            <input
              type="number"
              name="servings"
              min={1}
              max={50}
              value={servings}
              onChange={(e) => setServings(+e.target.value || 1)}
              className={inputCls}
            />
          </label>
          <label className="space-y-1 text-xs text-ink-dim">
            Serving description
            <input name="servingDesc" maxLength={60} placeholder="e.g. 1 bowl (350g)" className={inputCls} />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-dim">Ingredients</h2>
          <span className="text-[11px] text-ink-faint">Match foods from the database to auto-calculate macros</span>
        </div>
        <datalist id="food-options">
          {foodOptions.map((f) => (
            <option key={f.id} value={f.name} />
          ))}
        </datalist>
        {rows.map((row, i) => {
          const r = resolved[i];
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                list="food-options"
                value={row.foodName}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, foodName: e.target.value, rawText: e.target.value } : x)))}
                placeholder="Ingredient (e.g. Chicken breast)"
                className={inputCls}
              />
              <input
                type="number"
                value={row.grams}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
                placeholder="g"
                className={`${inputCls} w-24`}
              />
              <span className={`w-5 text-center text-sm ${r.food && r.grams ? "text-accent" : "text-ink-faint"}`}>
                {r.food && r.grams ? "✓" : "–"}
              </span>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-ink-faint hover:text-danger"
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button type="button" onClick={() => setRows([...rows, { rawText: "", foodName: "", grams: "" }])} className={btnGhost}>
          + Add ingredient
        </button>

        <div className={`rounded-xl border p-3 text-sm ${allLinked ? "border-accent/40 bg-accent/5" : "border-edge bg-surface"}`}>
          {allLinked ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-accent">✓ Calculated per serving:</span>
              <span>{per(tally.calories)} kcal</span>
              <span className="text-protein">{per(tally.proteinG)}g P</span>
              <span className="text-carbs">{per(tally.carbsG)}g C</span>
              <span className="text-fat">{per(tally.fatG)}g F</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-ink-dim">
                Some ingredients aren&apos;t matched to the food database — enter per-serving macros manually. The
                recipe will be labeled <span className="text-carbs">creator-entered</span> until verified.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ["calories", "kcal"],
                    ["proteinG", "P (g)"],
                    ["carbsG", "C (g)"],
                    ["fatG", "F (g)"],
                  ] as const
                ).map(([name, label]) => (
                  <label key={name} className="space-y-1 text-[10px] text-ink-dim">
                    {label}
                    <input type="number" step="0.1" name={name} className={inputCls} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-dim">Instructions</h2>
        <textarea
          name="instructions"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          placeholder={"1. Preheat the oven…\n2. …"}
          className={`${inputCls} resize-y`}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-dim">Details</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-xs text-ink-dim">
            Prep (min)
            <input type="number" name="prepMin" min={0} className={inputCls} />
          </label>
          <label className="space-y-1 text-xs text-ink-dim">
            Cook (min)
            <input type="number" name="cookMin" min={0} className={inputCls} />
          </label>
          <label className="space-y-1 text-xs text-ink-dim">
            Difficulty 1–5
            <input type="number" name="difficulty" min={1} max={5} className={inputCls} />
          </label>
          <label className="space-y-1 text-xs text-ink-dim">
            Cost/serv (¢)
            <input type="number" name="costCents" min={0} className={inputCls} />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RECIPE_TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTags(on ? tags.filter((x) => x !== t) : tags.length < 8 ? [...tags, t] : tags)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  on ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:bg-card-hover"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        {tags.map((t) => (
          <input key={t} type="hidden" name="tags" value={t} />
        ))}
      </section>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Publishing…" : "Publish recipe"}
      </button>
    </form>
  );
}
