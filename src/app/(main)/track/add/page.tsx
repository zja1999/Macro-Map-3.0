import Link from "next/link";
import { ilike, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSavedRecipes } from "@/lib/queries";
import { todayStr, MEAL_SLOTS } from "@/lib/utils";
import { logFood, logRecipe, quickAdd } from "@/actions/logging";
import { Card, inputCls, btnPrimary } from "@/components/ui";
import { MacroPills } from "@/components/macros";

export const metadata = { title: "Add food" };

export default async function AddFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; slot?: string; q?: string; tab?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayStr();
  const slot = MEAL_SLOTS.includes((sp.slot ?? "") as (typeof MEAL_SLOTS)[number]) ? sp.slot! : "snack";
  const tab = sp.tab === "saved" ? "saved" : sp.tab === "quick" ? "quick" : "search";
  const q = (sp.q ?? "").slice(0, 60);

  const results =
    tab === "search"
      ? await db
          .select()
          .from(foods)
          .where(q ? ilike(foods.name, `%${q}%`) : undefined)
          .orderBy(desc(foods.verified), foods.name)
          .limit(25)
      : [];
  const saved = tab === "saved" ? await getSavedRecipes(user.id) : [];

  const baseParams = `date=${date}&slot=${slot}`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">
          Add to <span className="capitalize text-accent">{slot}</span>
        </h1>
        <Link href={`/track?date=${date}`} className="text-xs text-ink-faint hover:text-ink">
          ← Back to diary
        </Link>
      </div>

      {/* slot switcher */}
      <div className="flex gap-1">
        {MEAL_SLOTS.map((s) => (
          <Link
            key={s}
            href={`/track/add?date=${date}&slot=${s}&tab=${tab}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-center text-xs capitalize ${
              s === slot ? "border-accent bg-accent/10 font-semibold text-accent" : "border-edge bg-card text-ink-dim"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* tabs */}
      <div className="flex gap-1 rounded-lg border border-edge bg-card p-1">
        {[
          { key: "search", label: "🔍 Search" },
          { key: "saved", label: "🔖 Saved recipes" },
          { key: "quick", label: "⚡ Quick add" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/track/add?${baseParams}&tab=${t.key}`}
            className={`flex-1 rounded-md px-2 py-1.5 text-center text-xs font-medium ${
              tab === t.key ? "bg-accent text-black" : "text-ink-dim"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "search" && (
        <>
          <form className="flex gap-2">
            <input type="hidden" name="date" value={date} />
            <input type="hidden" name="slot" value={slot} />
            <input name="q" defaultValue={q} placeholder="Search foods… (e.g. chicken)" className={inputCls} autoFocus />
            <button className={btnPrimary}>Search</button>
          </form>
          <div className="space-y-2">
            {results.map((f) => (
              <Card key={f.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {f.name}
                    {f.brand && <span className="text-ink-faint"> · {f.brand}</span>}
                    {f.verified && <span className="ml-1 text-accent" title="Verified">✓</span>}
                  </div>
                  <div className="mt-1">
                    <MacroPills calories={f.calories} proteinG={f.proteinG} carbsG={f.carbsG} fatG={f.fatG} />
                  </div>
                  <div className="mt-0.5 text-[10px] text-ink-faint">per {f.servingDesc}</div>
                </div>
                <form action={logFood} className="flex shrink-0 items-center gap-1.5">
                  <input type="hidden" name="foodId" value={f.id} />
                  <input type="hidden" name="logDate" value={date} />
                  <input type="hidden" name="mealSlot" value={slot} />
                  <input
                    type="number"
                    name="servings"
                    defaultValue={1}
                    step={0.25}
                    min={0.1}
                    max={50}
                    className={`${inputCls} w-16 px-2 py-1 text-center`}
                    aria-label="Servings"
                  />
                  <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Log</button>
                </form>
              </Card>
            ))}
            {q && results.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-faint">No foods match “{q}” — try Quick add.</p>
            )}
          </div>
        </>
      )}

      {tab === "saved" && (
        <div className="space-y-2">
          {saved.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">
              No saved recipes yet —{" "}
              <Link href="/recipes" className="text-accent hover:underline">
                browse the community
              </Link>
              .
            </p>
          )}
          {saved.map(({ recipe }) => (
            <Card key={recipe.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={`/recipes/${recipe.id}`} className="truncate text-sm font-medium hover:text-accent">
                  🍳 {recipe.name}
                </Link>
                <div className="mt-1">
                  <MacroPills calories={recipe.calories} proteinG={recipe.proteinG} carbsG={recipe.carbsG} fatG={recipe.fatG} />
                </div>
              </div>
              <form action={logRecipe} className="flex shrink-0 items-center gap-1.5">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="logDate" value={date} />
                <input type="hidden" name="mealSlot" value={slot} />
                <input
                  type="number"
                  name="servings"
                  defaultValue={1}
                  step={0.5}
                  min={0.5}
                  max={20}
                  className={`${inputCls} w-16 px-2 py-1 text-center`}
                  aria-label="Servings"
                />
                <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Log</button>
              </form>
            </Card>
          ))}
        </div>
      )}

      {tab === "quick" && (
        <Card className="p-4">
          <form action={quickAdd} className="space-y-3">
            <input type="hidden" name="logDate" value={date} />
            <input type="hidden" name="mealSlot" value={slot} />
            <input name="name" required maxLength={80} placeholder="What did you eat?" className={inputCls} />
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["calories", "kcal", true],
                  ["proteinG", "P (g)", false],
                  ["carbsG", "C (g)", false],
                  ["fatG", "F (g)", false],
                ] as const
              ).map(([name, label, req]) => (
                <label key={name} className="space-y-1 text-[10px] text-ink-dim">
                  {label}
                  <input type="number" name={name} step="0.1" min={0} required={req} className={inputCls} />
                </label>
              ))}
            </div>
            <button className={`${btnPrimary} w-full`}>Log it</button>
          </form>
        </Card>
      )}
    </div>
  );
}
