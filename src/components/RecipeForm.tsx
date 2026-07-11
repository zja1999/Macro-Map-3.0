"use client";

import { useActionState, useMemo, useState } from "react";
import { submitRecipe } from "@/actions/recipes";
import { RECIPE_TAGS, round1 } from "@/lib/utils";
import { inputCls, btnPrimary, btnGhost } from "./ui";
import { CoverPhotoInput } from "./CoverPhotoInput";

export type FoodOption = {
  id: string;
  name: string;
  servingGrams: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  personal?: boolean; // from the user's private ingredient library
};

type Per100 = { calories: string; proteinG: string; carbsG: string; fatG: string };
type IngredientRow = { rawText: string; foodName: string; grams: string; per100: Per100 | null };

const emptyPer100: Per100 = { calories: "", proteinG: "", carbsG: "", fatG: "" };

export function RecipeForm({ foodOptions }: { foodOptions: FoodOption[] }) {
  const [rows, setRows] = useState<IngredientRow[]>([{ rawText: "", foodName: "", grams: "", per100: null }]);
  const [servings, setServings] = useState(4);
  const [tags, setTags] = useState<string[]>([]);
  const [state, action, pending] = useActionState(submitRecipe, undefined);

  // shared foods win name collisions with personal entries
  const foodByName = useMemo(() => {
    const m = new Map(foodOptions.filter((f) => f.personal).map((f) => [f.name.toLowerCase(), f]));
    for (const f of foodOptions) if (!f.personal) m.set(f.name.toLowerCase(), f);
    return m;
  }, [foodOptions]);

  const resolved = rows.map((r) => {
    const food = foodByName.get(r.foodName.trim().toLowerCase()) ?? null;
    const grams = parseFloat(r.grams) || null;
    // an unmatched ingredient with per-100g macros entered counts as linked —
    // it becomes a personal ingredient on submit
    const per100 =
      !food && r.per100 && Object.values(r.per100).every((v) => v !== "" && isFinite(parseFloat(v)))
        ? {
            calories: parseFloat(r.per100.calories),
            proteinG: parseFloat(r.per100.proteinG),
            carbsG: parseFloat(r.per100.carbsG),
            fatG: parseFloat(r.per100.fatG),
          }
        : null;
    return { ...r, food, grams, per100Parsed: per100 };
  });
  const allLinked = resolved.length > 0 && resolved.every((r) => (r.food || r.per100Parsed) && r.grams);

  const tally = resolved.reduce(
    (acc, r) => {
      if (!r.grams) return acc;
      const src = r.food?.servingGrams
        ? { f: r.grams / r.food.servingGrams, m: r.food }
        : r.per100Parsed
          ? { f: r.grams / 100, m: r.per100Parsed }
          : null;
      if (src) {
        acc.calories += src.m.calories * src.f;
        acc.proteinG += src.m.proteinG * src.f;
        acc.carbsG += src.m.carbsG * src.f;
        acc.fatG += src.m.fatG * src.f;
      }
      return acc;
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const per = (n: number) => round1(n / Math.max(1, servings));

  const ingredientsPayload = JSON.stringify(
    resolved.map((r) => ({
      rawText: r.rawText || `${r.grams ?? ""}g ${r.foodName}`.trim(),
      foodId: r.food && !r.food.personal && r.grams ? r.food.id : null,
      personalIngredientId: r.food?.personal && r.grams ? r.food.id : null,
      grams: r.grams,
      newPersonal:
        r.per100Parsed && r.grams && r.foodName.trim() ? { name: r.foodName.trim(), ...r.per100Parsed } : null,
    })),
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="ingredients" value={ingredientsPayload} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-dim">Basics</h2>
        <CoverPhotoInput />
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
            <option key={f.id} value={f.name} label={f.personal ? `${f.name} (my library)` : f.name} />
          ))}
        </datalist>
        {rows.map((row, i) => {
          const r = resolved[i];
          const linked = (r.food || r.per100Parsed) && r.grams;
          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
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
                <span
                  className={`w-5 text-center text-sm ${linked ? "text-accent" : "text-ink-faint"}`}
                  title={r.food?.personal ? "From your ingredient library" : undefined}
                >
                  {linked ? (r.food?.personal || r.per100Parsed ? "✓*" : "✓") : "–"}
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
              {/* no database match → enter macros once, it saves to the personal library */}
              {!r.food && row.foodName.trim().length > 1 && (
                <div className="ml-1 rounded-lg border border-dashed border-edge px-2.5 py-2">
                  {row.per100 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[10px] text-ink-faint">per 100g:</span>
                      {(
                        [
                          ["calories", "kcal"],
                          ["proteinG", "P"],
                          ["carbsG", "C"],
                          ["fatG", "F"],
                        ] as const
                      ).map(([k, label]) => (
                        <input
                          key={k}
                          type="number"
                          step="0.1"
                          min={0}
                          value={row.per100![k]}
                          onChange={(e) =>
                            setRows(rows.map((x, j) => (j === i ? { ...x, per100: { ...x.per100!, [k]: e.target.value } } : x)))
                          }
                          placeholder={label}
                          className={`${inputCls} w-16 px-2 py-1 text-xs`}
                          aria-label={`${label} per 100g`}
                        />
                      ))}
                      <span className="text-[10px] text-ink-faint">→ saved to your library</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRows(rows.map((x, j) => (j === i ? { ...x, per100: emptyPer100 } : x)))}
                      className="text-[11px] text-accent hover:underline"
                    >
                      Not in the database — add its macros once (saves to your library)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setRows([...rows, { rawText: "", foodName: "", grams: "", per100: null }])}
          className={btnGhost}
        >
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
