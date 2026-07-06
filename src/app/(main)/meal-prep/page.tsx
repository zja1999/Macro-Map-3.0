import Link from "next/link";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { mealPrepPlans, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Card, EmptyState, btnPrimary } from "@/components/ui";
import { MacroPills } from "@/components/macros";

export const metadata = { title: "Meal prep" };

// Boards are saved filter+sort presets over one ranked ordering — not separate systems (docs/06 §6)
const BOARDS = [
  { key: "top", label: "🔥 Top rated" },
  { key: "budget", label: "💸 Best budget" },
  { key: "five-day", label: "📅 5-day plans" },
  { key: "protein", label: "🍗 High protein" },
] as const;

export default async function MealPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const board = BOARDS.some((b) => b.key === sp.board) ? sp.board! : "top";

  const conds = [eq(mealPrepPlans.status, "published")];
  if (board === "budget") conds.push(lte(mealPrepPlans.costPerServingCents, 300));
  if (board === "five-day") conds.push(gte(mealPrepPlans.daysCovered, 5));
  if (board === "protein") conds.push(gte(mealPrepPlans.proteinG, 35));

  const rows = await db
    .select({ plan: mealPrepPlans, username: profiles.username, displayName: profiles.displayName })
    .from(mealPrepPlans)
    .innerJoin(profiles, eq(profiles.userId, mealPrepPlans.authorId))
    .where(and(...conds))
    .orderBy(
      desc(sql`(${mealPrepPlans.upvotes} - ${mealPrepPlans.downvotes}) * 3 + ${mealPrepPlans.saveCount} * 2`),
      desc(mealPrepPlans.createdAt),
    )
    .limit(30);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">🥡 Meal prep plans</h1>
        {user && (
          <Link href="/meal-prep/new" className={btnPrimary}>
            + Create plan
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        {BOARDS.map((b) => (
          <Link
            key={b.key}
            href={b.key === "top" ? "/meal-prep" : `/meal-prep?board=${b.key}`}
            className={`rounded-full border px-2.5 py-1 ${
              board === b.key ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim"
            }`}
          >
            {b.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No plans on this board yet"
          hint="Compose a plan from community recipes — macros and cost are calculated automatically."
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ plan, username, displayName }) => (
            <Card key={plan.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/meal-prep/${plan.id}`} className="text-sm font-medium hover:text-accent">
                    {plan.title}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-ink-faint">
                    <Link href={`/u/${username}`} className="hover:text-accent">
                      {displayName}
                    </Link>
                    {plan.daysCovered && ` · ${plan.daysCovered} days`}
                    {` · ${plan.totalServings} servings`}
                    {plan.costPerServingCents != null && ` · ~$${(plan.costPerServingCents / 100).toFixed(2)}/serving`}
                  </div>
                  <div className="mt-1.5">
                    <MacroPills calories={plan.calories} proteinG={plan.proteinG} carbsG={plan.carbsG} fatG={plan.fatG} />
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums text-ink-dim">
                  <div className="font-bold text-accent">▲ {plan.upvotes - plan.downvotes}</div>
                  {plan.saveCount > 0 && <div className="mt-0.5">🔖 {plan.saveCount}</div>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="text-center text-[10px] text-ink-faint">Per-serving macros shown — derived from member recipes.</p>
    </div>
  );
}
