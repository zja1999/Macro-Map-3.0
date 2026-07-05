import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { foods, personalIngredients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { RecipeForm, type FoodOption } from "@/components/RecipeForm";

export const metadata = { title: "Submit recipe" };

export default async function NewRecipePage() {
  const user = await requireUser();
  const [foodRows, personalRows] = await Promise.all([
    db
      .select({
        id: foods.id,
        name: foods.name,
        servingGrams: foods.servingGrams,
        calories: foods.calories,
        proteinG: foods.proteinG,
        carbsG: foods.carbsG,
        fatG: foods.fatG,
      })
      .from(foods)
      .orderBy(foods.name)
      .limit(500),
    db
      .select({
        id: personalIngredients.id,
        name: personalIngredients.name,
        servingGrams: personalIngredients.servingGrams,
        calories: personalIngredients.calories,
        proteinG: personalIngredients.proteinG,
        carbsG: personalIngredients.carbsG,
        fatG: personalIngredients.fatG,
      })
      .from(personalIngredients)
      .where(eq(personalIngredients.userId, user.id))
      .orderBy(personalIngredients.name)
      .limit(200),
  ]);

  const foodOptions: FoodOption[] = [
    ...foodRows,
    ...personalRows.map((p) => ({ ...p, personal: true as const })),
  ];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">Submit a recipe</h1>
      <p className="text-xs text-ink-dim">
        Recipes with every ingredient matched to the food database get a{" "}
        <span className="text-accent">✓ calculated-from-ingredients</span> macro label and rank higher in discovery.
        Ingredients you add macros for once land in your private library for next time.
      </p>
      <RecipeForm foodOptions={foodOptions} />
    </div>
  );
}
