import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recipes } from "@/db/schema";
import { MealPrepForm } from "@/components/MealPrepForm";

export const metadata = { title: "Create meal prep plan" };

export default async function NewMealPrepPage() {
  const recipeOptions = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      calories: recipes.calories,
      proteinG: recipes.proteinG,
      costCents: recipes.costCents,
    })
    .from(recipes)
    .where(eq(recipes.status, "published"))
    .orderBy(recipes.name)
    .limit(500);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">Compose a meal prep plan</h1>
      <p className="text-xs text-ink-dim">
        Pick community recipes and how many servings of each the week uses. Plan macros and cost per serving are
        derived automatically — trust stays structural.
      </p>
      <MealPrepForm recipeOptions={recipeOptions} />
    </div>
  );
}
