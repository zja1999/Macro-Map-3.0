"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { foods, groceryItems, groceryLists, mealPrepItems, recipeIngredients, recipes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** Keyword section guesser — good enough until foods carry grocery sections. */
function guessSection(name: string): string {
  const n = name.toLowerCase();
  if (/chicken|beef|turkey|salmon|tuna|shrimp|pork|egg/.test(n)) return "protein";
  if (/yogurt|milk|cheese|butter|cottage/.test(n)) return "dairy";
  if (/broccoli|spinach|pepper|onion|tomato|cucumber|avocado|banana|berr|apple|potato|lettuce|veggie|fruit/.test(n))
    return "produce";
  if (/frozen/.test(n)) return "frozen";
  return "pantry";
}

async function getOrCreateList(userId: string): Promise<string> {
  const [existing] = await db.select().from(groceryLists).where(eq(groceryLists.userId, userId)).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(groceryLists).values({ userId }).returning({ id: groceryLists.id });
  return created.id;
}

export async function addGroceryItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = z.string().min(1).max(80).parse(formData.get("name"));
  const quantity = z.string().max(30).optional().parse(formData.get("quantity") || undefined);
  const listId = await getOrCreateList(user.id);
  await db.insert(groceryItems).values({ listId, name, quantity: quantity ?? null, section: guessSection(name) });
  revalidatePath("/groceries");
}

export async function toggleGroceryItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = z.string().uuid().parse(formData.get("id"));
  const listId = await getOrCreateList(user.id);
  const [item] = await db
    .select()
    .from(groceryItems)
    .where(and(eq(groceryItems.id, id), eq(groceryItems.listId, listId)));
  if (item) await db.update(groceryItems).set({ purchased: !item.purchased }).where(eq(groceryItems.id, id));
  revalidatePath("/groceries");
}

export async function deleteGroceryItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = z.string().uuid().parse(formData.get("id"));
  const listId = await getOrCreateList(user.id);
  await db.delete(groceryItems).where(and(eq(groceryItems.id, id), eq(groceryItems.listId, listId)));
  revalidatePath("/groceries");
}

export async function clearPurchased() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const listId = await getOrCreateList(user.id);
  await db.delete(groceryItems).where(and(eq(groceryItems.listId, listId), eq(groceryItems.purchased, true)));
  revalidatePath("/groceries");
}

/** Recipe → grocery list with dedupe: same ingredient merges grams instead of duplicating rows. */
async function addIngredientRows(
  userId: string,
  rows: { name: string; grams: number | null; sourceRecipeId: string; costCents?: number | null }[],
) {
  const listId = await getOrCreateList(userId);
  const existing = await db
    .select()
    .from(groceryItems)
    .where(and(eq(groceryItems.listId, listId), eq(groceryItems.purchased, false)));
  const byName = new Map(existing.map((i) => [i.name.toLowerCase(), i]));

  for (const row of rows) {
    const prev = byName.get(row.name.toLowerCase());
    if (prev) {
      const prevGrams = parseFloat(prev.quantity ?? "");
      const merged =
        row.grams != null && Number.isFinite(prevGrams) ? `${Math.round(prevGrams + row.grams)} g` : prev.quantity;
      await db.update(groceryItems).set({ quantity: merged }).where(eq(groceryItems.id, prev.id));
    } else {
      const [inserted] = await db
        .insert(groceryItems)
        .values({
          listId,
          name: row.name,
          quantity: row.grams != null ? `${Math.round(row.grams)} g` : null,
          section: guessSection(row.name),
          estCostCents: row.costCents ?? null,
          sourceRecipeId: row.sourceRecipeId,
        })
        .returning();
      byName.set(row.name.toLowerCase(), inserted);
    }
  }
}

async function ingredientRowsForRecipe(recipeId: string, servingsFactor = 1) {
  const rows = await db
    .select({ ing: recipeIngredients, foodName: foods.name })
    .from(recipeIngredients)
    .leftJoin(foods, eq(foods.id, recipeIngredients.foodId))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.position));
  return rows.map((r) => ({
    name: (r.foodName ?? r.ing.rawText).slice(0, 80),
    grams: r.ing.grams != null ? r.ing.grams * servingsFactor : null,
    sourceRecipeId: recipeId,
  }));
}

export async function addRecipeToGroceries(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const recipeId = z.string().uuid().parse(formData.get("recipeId"));
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) throw new Error("Recipe not found");
  await addIngredientRows(user.id, await ingredientRowsForRecipe(recipeId));
  redirect("/groceries?added=1");
}

/** Whole meal-prep plan → grocery list: every member recipe's ingredients, deduped together. */
export async function addPlanToGroceries(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const planId = z.string().uuid().parse(formData.get("planId"));
  const members = await db.select().from(mealPrepItems).where(eq(mealPrepItems.planId, planId));
  if (!members.length) throw new Error("Plan has no recipes");
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, members.map((m) => m.recipeId)));
  const servingsById = new Map(recipeRows.map((r) => [r.id, r.servings]));

  const all: { name: string; grams: number | null; sourceRecipeId: string }[] = [];
  for (const m of members) {
    // scale: plan wants m.servings servings out of a recipe that makes recipe.servings
    const factor = m.servings / Math.max(1, servingsById.get(m.recipeId) ?? 1);
    all.push(...(await ingredientRowsForRecipe(m.recipeId, factor)));
  }
  await addIngredientRows(user.id, all);
  redirect("/groceries?added=1");
}
