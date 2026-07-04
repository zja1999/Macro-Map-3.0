import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { RecipeForm } from "@/components/RecipeForm";

export const metadata = { title: "Submit recipe" };

export default async function NewRecipePage() {
  const foodOptions = await db
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
    .limit(500);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">Submit a recipe</h1>
      <p className="text-xs text-ink-dim">
        Recipes with every ingredient matched to the food database get a{" "}
        <span className="text-accent">✓ calculated-from-ingredients</span> macro label and rank higher in discovery.
      </p>
      <RecipeForm foodOptions={foodOptions} />
    </div>
  );
}
