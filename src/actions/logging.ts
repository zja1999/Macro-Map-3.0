"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { foodLogs, foods, recipes, waterLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { round1, shiftDate } from "@/lib/utils";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const slotEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);

const logFoodSchema = z.object({
  foodId: z.string().uuid(),
  logDate: z.string().regex(dateRe),
  mealSlot: slotEnum,
  servings: z.coerce.number().min(0.1).max(50),
});

export async function logFood(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = logFoodSchema.parse(Object.fromEntries(formData));

  const [food] = await db.select().from(foods).where(eq(foods.id, d.foodId)).limit(1);
  if (!food) throw new Error("Food not found");

  await db.insert(foodLogs).values({
    userId: user.id,
    logDate: d.logDate,
    mealSlot: d.mealSlot,
    foodId: food.id,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    servings: d.servings,
    calories: round1(food.calories * d.servings),
    proteinG: round1(food.proteinG * d.servings),
    carbsG: round1(food.carbsG * d.servings),
    fatG: round1(food.fatG * d.servings),
  });
  revalidatePath("/track");
  redirect(`/track?date=${d.logDate}`);
}

const logRecipeSchema = z.object({
  recipeId: z.string().uuid(),
  logDate: z.string().regex(dateRe),
  mealSlot: slotEnum,
  servings: z.coerce.number().min(0.1).max(20),
});

export async function logRecipe(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = logRecipeSchema.parse(Object.fromEntries(formData));

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, d.recipeId)).limit(1);
  if (!recipe) throw new Error("Recipe not found");

  await db.transaction(async (tx) => {
    await tx.insert(foodLogs).values({
      userId: user.id,
      logDate: d.logDate,
      mealSlot: d.mealSlot,
      recipeId: recipe.id,
      name: recipe.name,
      servings: d.servings,
      calories: round1(recipe.calories * d.servings),
      proteinG: round1(recipe.proteinG * d.servings),
      carbsG: round1(recipe.carbsG * d.servings),
      fatG: round1(recipe.fatG * d.servings),
    });
    // logging community content is the strongest quality signal (docs/06 §5)
    await tx
      .update(recipes)
      .set({ logCount: sql`${recipes.logCount} + 1` })
      .where(eq(recipes.id, recipe.id));
  });
  revalidatePath("/track");
  redirect(`/track?date=${d.logDate}`);
}

const quickAddSchema = z.object({
  name: z.string().min(1).max(80),
  logDate: z.string().regex(dateRe),
  mealSlot: slotEnum,
  calories: z.coerce.number().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500).default(0),
  carbsG: z.coerce.number().min(0).max(1000).default(0),
  fatG: z.coerce.number().min(0).max(500).default(0),
});

export async function quickAdd(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = quickAddSchema.parse(Object.fromEntries(formData));
  await db.insert(foodLogs).values({
    userId: user.id,
    logDate: d.logDate,
    mealSlot: d.mealSlot,
    name: d.name,
    servings: 1,
    calories: d.calories,
    proteinG: d.proteinG,
    carbsG: d.carbsG,
    fatG: d.fatG,
  });
  revalidatePath("/track");
  redirect(`/track?date=${d.logDate}`);
}

export async function deleteLog(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = z.string().uuid().parse(formData.get("id"));
  const logDate = z.string().regex(dateRe).parse(formData.get("logDate"));
  await db.delete(foodLogs).where(and(eq(foodLogs.id, id), eq(foodLogs.userId, user.id)));
  revalidatePath("/track");
  redirect(`/track?date=${logDate}`);
}

export async function copyPreviousDay(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const logDate = z.string().regex(dateRe).parse(formData.get("logDate"));
  const prev = shiftDate(logDate, -1);

  const prevLogs = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, user.id), eq(foodLogs.logDate, prev)));
  if (prevLogs.length) {
    await db.insert(foodLogs).values(
      prevLogs.map((l) => ({
        userId: user.id,
        logDate,
        mealSlot: l.mealSlot,
        foodId: l.foodId,
        recipeId: l.recipeId,
        name: l.name,
        servings: l.servings,
        calories: l.calories,
        proteinG: l.proteinG,
        carbsG: l.carbsG,
        fatG: l.fatG,
      })),
    );
  }
  revalidatePath("/track");
  redirect(`/track?date=${logDate}`);
}

export async function addWater(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const logDate = z.string().regex(dateRe).parse(formData.get("logDate"));
  const ml = z.coerce.number().int().min(-1000).max(2000).parse(formData.get("ml"));
  await db
    .insert(waterLogs)
    .values({ userId: user.id, logDate, ml: Math.max(0, ml) })
    .onConflictDoUpdate({
      target: [waterLogs.userId, waterLogs.logDate],
      set: { ml: sql`GREATEST(0, ${waterLogs.ml} + ${ml})` },
    });
  revalidatePath("/track");
  redirect(`/track?date=${logDate}`);
}
