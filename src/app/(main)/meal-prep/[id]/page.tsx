import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { mealPrepItems, mealPrepPlans, profiles, recipes, saves, votes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { todayStr, MEAL_SLOTS, slotForNow } from "@/lib/utils";
import { votePlan, toggleSavePlan } from "@/actions/mealPreps";
import { addPlanToGroceries } from "@/actions/groceries";
import { logRecipe } from "@/actions/logging";
import { Card, UserChip, btnGhost } from "@/components/ui";
import { MacroPills } from "@/components/macros";

export default async function MealPrepDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [row] = await db
    .select({ plan: mealPrepPlans, username: profiles.username, displayName: profiles.displayName })
    .from(mealPrepPlans)
    .innerJoin(profiles, eq(profiles.userId, mealPrepPlans.authorId))
    .where(eq(mealPrepPlans.id, id))
    .limit(1);
  if (!row) notFound();
  const { plan, username, displayName } = row;

  const members = await db.select().from(mealPrepItems).where(eq(mealPrepItems.planId, id)).orderBy(asc(mealPrepItems.position));
  const recipeRows = members.length
    ? await db.select().from(recipes).where(inArray(recipes.id, members.map((m) => m.recipeId)))
    : [];
  const recipeById = new Map(recipeRows.map((r) => [r.id, r]));

  const [myVote] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "meal_prep_plan"), eq(votes.subjectId, id)));
  const [savedRow] = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, user.id), eq(saves.subjectType, "meal_prep_plan"), eq(saves.subjectId, id)));

  const net = plan.upvotes - plan.downvotes;
  const date = todayStr();
  const slot = slotForNow();

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-tight">{plan.title}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <form action={votePlan}>
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="value" value="1" />
              <button
                className={`rounded-lg border px-2.5 py-1.5 text-sm font-bold ${
                  myVote?.value === 1 ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:text-accent"
                }`}
              >
                ▲
              </button>
            </form>
            <span className={`min-w-6 text-center text-sm font-bold tabular-nums ${net > 0 ? "text-accent" : "text-ink-dim"}`}>
              {net}
            </span>
            <form action={votePlan}>
              <input type="hidden" name="planId" value={plan.id} />
              <input type="hidden" name="value" value="-1" />
              <button
                className={`rounded-lg border px-2.5 py-1.5 text-sm font-bold ${
                  myVote?.value === -1 ? "border-danger bg-danger/15 text-danger" : "border-edge bg-card text-ink-dim"
                }`}
              >
                ▼
              </button>
            </form>
            <form action={toggleSavePlan}>
              <input type="hidden" name="planId" value={plan.id} />
              <button
                className={`ml-1 rounded-lg border px-2.5 py-1.5 text-sm ${
                  savedRow ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:text-accent"
                }`}
              >
                🔖
              </button>
            </form>
          </div>
        </div>
        <UserChip username={username} displayName={displayName} sub="plan author" />
        {plan.description && <p className="text-sm text-ink-dim">{plan.description}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          {plan.daysCovered && <span>📅 {plan.daysCovered} days</span>}
          <span>🍱 {plan.totalServings} servings</span>
          {plan.costPerServingCents != null && <span>💸 ~${(plan.costPerServingCents / 100).toFixed(2)}/serving</span>}
        </div>
        <Card className="flex items-center justify-between p-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-ink-faint">Per serving</div>
            <MacroPills calories={plan.calories} proteinG={plan.proteinG} carbsG={plan.carbsG} fatG={plan.fatG} />
          </div>
          <form action={addPlanToGroceries}>
            <input type="hidden" name="planId" value={plan.id} />
            <button className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-black">🛒 Add all to groceries</button>
          </form>
        </Card>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-ink-dim">Recipes in this plan</h2>
        {members.map((m) => {
          const recipe = recipeById.get(m.recipeId);
          if (!recipe) return null;
          return (
            <Card key={`${m.planId}-${m.position}`} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={`/recipes/${recipe.id}`} className="truncate text-sm font-medium hover:text-accent">
                  🍳 {recipe.name}
                </Link>
                <div className="text-[11px] text-ink-faint">{m.servings} servings this week</div>
                <div className="mt-1">
                  <MacroPills calories={recipe.calories} proteinG={recipe.proteinG} carbsG={recipe.carbsG} fatG={recipe.fatG} />
                </div>
              </div>
              <form action={logRecipe} className="flex shrink-0 items-center gap-1.5">
                <input type="hidden" name="recipeId" value={recipe.id} />
                <input type="hidden" name="logDate" value={date} />
                <input type="hidden" name="mealSlot" value={slot} />
                <input type="hidden" name="servings" value={1} />
                <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Log 1</button>
              </form>
            </Card>
          );
        })}
      </section>

      {plan.storageNotes && (
        <Card className="p-3 text-xs text-ink-dim">
          <span className="font-semibold">Storage:</span> {plan.storageNotes}
        </Card>
      )}
      <Link href="/meal-prep" className={btnGhost}>
        ← All plans
      </Link>
    </div>
  );
}
