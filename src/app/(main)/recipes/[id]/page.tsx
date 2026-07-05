import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes, recipeIngredients, profiles, foods, contentWarnings } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getRecipeInteractions } from "@/lib/queries";
import { todayStr, MEAL_SLOTS } from "@/lib/utils";
import { voteRecipe, toggleSaveRecipe, reviewRecipe } from "@/actions/recipes";
import { logRecipe } from "@/actions/logging";
import { addRecipeToGroceries } from "@/actions/groceries";
import { shareRecipeToFeed } from "@/actions/social";
import { Card, Badge, UserChip, inputCls, btnGhost } from "@/components/ui";
import { MacroPills, ProvenanceBadge } from "@/components/macros";
import { CommentSection } from "@/components/CommentSection";
import { ReportButton } from "@/components/ReportButton";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [row] = await db
    .select({ recipe: recipes, username: profiles.username, displayName: profiles.displayName })
    .from(recipes)
    .innerJoin(profiles, eq(profiles.userId, recipes.authorId))
    .where(eq(recipes.id, id))
    .limit(1);
  if (!row) notFound();
  const { recipe, username, displayName } = row;

  const [ingredients, { myVote, saved }, warnings] = await Promise.all([
    db
      .select({ ing: recipeIngredients, foodName: foods.name })
      .from(recipeIngredients)
      .leftJoin(foods, eq(foods.id, recipeIngredients.foodId))
      .where(eq(recipeIngredients.recipeId, id))
      .orderBy(asc(recipeIngredients.position)),
    getRecipeInteractions(user.id, id),
    db
      .select()
      .from(contentWarnings)
      .where(and(eq(contentWarnings.subjectType, "recipe"), eq(contentWarnings.subjectId, id))),
  ]);

  const net = recipe.upvotes - recipe.downvotes;
  const rating = recipe.ratingCount > 0 ? (recipe.ratingSum / recipe.ratingCount).toFixed(1) : null;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {warnings.map((w) => (
        <p key={w.kind} className="rounded-xl border border-carbs/40 bg-carbs/10 px-4 py-3 text-xs text-carbs">
          ⚠ Community warning: {w.kind.replace(/_/g, " ")}
          {w.note && ` — ${w.note}`}
        </p>
      ))}
      {/* header */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-tight">{recipe.name}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <form action={voteRecipe}>
              <input type="hidden" name="recipeId" value={recipe.id} />
              <input type="hidden" name="value" value="1" />
              <button
                className={`rounded-lg border px-2.5 py-1.5 text-sm font-bold ${
                  myVote === 1 ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:text-accent"
                }`}
              >
                ▲
              </button>
            </form>
            <span className={`min-w-6 text-center text-sm font-bold tabular-nums ${net > 0 ? "text-accent" : "text-ink-dim"}`}>
              {net}
            </span>
            <form action={voteRecipe}>
              <input type="hidden" name="recipeId" value={recipe.id} />
              <input type="hidden" name="value" value="-1" />
              <button
                className={`rounded-lg border px-2.5 py-1.5 text-sm font-bold ${
                  myVote === -1 ? "border-fat bg-fat/15 text-fat" : "border-edge bg-card text-ink-dim hover:text-fat"
                }`}
              >
                ▼
              </button>
            </form>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <UserChip username={username} displayName={displayName} />
          <form action={toggleSaveRecipe}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <button className={btnGhost}>{saved ? "🔖 Saved" : "🔖 Save"}</button>
          </form>
        </div>
        {recipe.description && <p className="text-sm text-ink-dim">{recipe.description}</p>}
        <div className="flex flex-wrap gap-1">
          {recipe.tags.map((t) => (
            <Link key={t} href={`/recipes?tag=${t}`} className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-ink-faint hover:text-accent">
              #{t}
            </Link>
          ))}
        </div>
      </div>

      {/* macro panel */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Per serving{recipe.servingDesc ? ` · ${recipe.servingDesc}` : ""}
          </span>
          <ProvenanceBadge source={recipe.macroSource} confidence={recipe.macroConfidence} />
        </div>
        <MacroPills calories={recipe.calories} proteinG={recipe.proteinG} carbsG={recipe.carbsG} fatG={recipe.fatG} />
        <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-faint">
          {rating && <Badge>★ {rating} ({recipe.ratingCount})</Badge>}
          <Badge>logged {recipe.logCount}×</Badge>
          <Badge>tried by {recipe.triedCount}</Badge>
          <Badge>🔖 {recipe.saveCount}</Badge>
          {recipe.prepMin != null && <Badge>⏱ {(recipe.prepMin ?? 0) + (recipe.cookMin ?? 0)} min</Badge>}
          {recipe.difficulty != null && <Badge>difficulty {recipe.difficulty}/5</Badge>}
          {recipe.costCents != null && <Badge>${(recipe.costCents / 100).toFixed(2)}/serv</Badge>}
        </div>

        {/* log it */}
        <form action={logRecipe} className="flex items-center gap-2 border-t border-edge pt-3">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="logDate" value={todayStr()} />
          <select name="mealSlot" defaultValue="dinner" className="rounded-lg border border-edge bg-surface px-2 py-2 text-xs capitalize">
            {MEAL_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            name="servings"
            defaultValue={1}
            step={0.5}
            min={0.5}
            max={20}
            className={`${inputCls} w-20 text-center`}
            aria-label="Servings"
          />
          <button className="flex-1 rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black hover:brightness-110">
            Log to today
          </button>
        </form>
      </Card>

      {/* ingredients */}
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ingredients <span className="text-xs font-normal text-ink-faint">· makes {recipe.servings} servings</span></h2>
          <form action={addRecipeToGroceries}>
            <input type="hidden" name="recipeId" value={recipe.id} />
            <button className="rounded-md bg-accent/10 px-2 py-1 text-xs font-semibold text-accent hover:bg-accent/20">
              🛒 Add to groceries
            </button>
          </form>
        </div>
        <ul className="space-y-1.5">
          {ingredients.map(({ ing, foodName }) => (
            <li key={ing.id} className="flex items-center gap-2 text-sm text-ink-dim">
              <span className={foodName ? "text-accent" : "text-ink-faint"}>{foodName ? "✓" : "•"}</span>
              {ing.grams ? `${ing.grams}g ` : ""}
              {foodName ?? ing.rawText}
            </li>
          ))}
        </ul>
      </Card>

      {/* instructions */}
      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Instructions</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">{recipe.instructions}</p>
      </Card>

      {/* tried / rate + share */}
      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Tried it?</h2>
        <form action={reviewRecipe} className="flex items-center gap-2">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <select name="rating" className="rounded-lg border border-edge bg-surface px-2 py-2 text-xs">
            <option value="">Rate…</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {"★".repeat(r)}
              </option>
            ))}
          </select>
          <input name="body" maxLength={500} placeholder="Quick review (optional)" className={inputCls} />
          <button className={btnGhost}>Mark tried</button>
        </form>
        <form action={shareRecipeToFeed} className="flex items-center gap-2 border-t border-edge pt-3">
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input name="body" maxLength={500} placeholder="Say something and share to your feed…" className={inputCls} />
          <button className={btnGhost}>Share</button>
        </form>
      </Card>

      {recipe.authorId !== user.id && <ReportButton subjectType="recipe" subjectId={recipe.id} />}
      <CommentSection subjectType="recipe" subjectId={recipe.id} />
    </div>
  );
}
