"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { recipes, recipeIngredients, recipeReviews, votes, saves, foods, users, personalIngredients } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { round1, RECIPE_TAGS } from "@/lib/utils";

// ─── submit ──────────────────────────────────────────────────────────────────

const ingredientSchema = z.object({
  rawText: z.string().min(1).max(120),
  foodId: z.string().uuid().nullable(),
  personalIngredientId: z.string().uuid().nullable().default(null), // user's private library (docs/08 §1b)
  grams: z.number().min(0).max(5000).nullable(),
  // macros entered inline for an unmatched ingredient — becomes a personal_ingredients row
  newPersonal: z
    .object({
      name: z.string().min(1).max(80),
      calories: z.number().min(0).max(900),
      proteinG: z.number().min(0).max(100),
      carbsG: z.number().min(0).max(100),
      fatG: z.number().min(0).max(100),
    })
    .nullable()
    .default(null),
});

const submitSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  instructions: z.string().min(10).max(5000),
  servings: z.coerce.number().min(1).max(50),
  servingDesc: z.string().max(60).optional(),
  prepMin: z.coerce.number().min(0).max(600).optional(),
  cookMin: z.coerce.number().min(0).max(600).optional(),
  difficulty: z.coerce.number().min(1).max(5).optional(),
  costCents: z.coerce.number().min(0).max(50000).optional(),
  tags: z.array(z.enum(RECIPE_TAGS)).max(8),
  ingredients: z.array(ingredientSchema).min(1).max(30),
  // manual per-serving macros — required when ingredients aren't fully linked
  calories: z.coerce.number().min(0).max(5000).optional(),
  proteinG: z.coerce.number().min(0).max(500).optional(),
  carbsG: z.coerce.number().min(0).max(1000).optional(),
  fatG: z.coerce.number().min(0).max(500).optional(),
});

export async function submitRecipe(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let payload: z.infer<typeof submitSchema>;
  try {
    payload = submitSchema.parse({
      ...Object.fromEntries(formData),
      tags: formData.getAll("tags"),
      ingredients: JSON.parse(String(formData.get("ingredients") ?? "[]")),
    });
  } catch (e) {
    return { error: e instanceof z.ZodError ? e.issues[0].message : "Invalid submission" };
  }

  // Compute macros from linked ingredients: shared foods, the user's personal
  // library, and inline "save to my library" entries all count as linked.
  const isLinked = (i: (typeof payload.ingredients)[number]) =>
    (i.foodId || i.personalIngredientId || i.newPersonal) && i.grams;
  const linked = payload.ingredients.filter(isLinked);
  const allLinked = linked.length === payload.ingredients.length && linked.length > 0;

  let perServing = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  let macroSource = "creator_entered";
  let macroConfidence = 0.3;

  if (allLinked) {
    const foodIds = [...new Set(linked.map((i) => i.foodId).filter((v): v is string => !!v))];
    const personalIds = [...new Set(linked.map((i) => i.personalIngredientId).filter((v): v is string => !!v))];
    const foodRows = foodIds.length ? await db.select().from(foods).where(inArray(foods.id, foodIds)) : [];
    const personalRows = personalIds.length
      ? await db
          .select()
          .from(personalIngredients)
          .where(and(inArray(personalIngredients.id, personalIds), eq(personalIngredients.userId, user.id)))
      : [];
    if (foodRows.length !== foodIds.length || personalRows.length !== personalIds.length) {
      return { error: "One ingredient no longer exists. Refresh and try again." };
    }
    const byId = new Map<string, { servingGrams: number | null; calories: number; proteinG: number; carbsG: number; fatG: number }>([
      ...foodRows.map((f) => [f.id, f] as const),
      ...personalRows.map((p) => [p.id, p] as const),
    ]);
    const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    for (const ing of linked) {
      const src = ing.newPersonal
        ? { servingGrams: 100, ...ing.newPersonal }
        : byId.get(ing.foodId ?? ing.personalIngredientId ?? "");
      if (!src || !src.servingGrams) continue;
      const factor = ing.grams! / src.servingGrams;
      totals.calories += src.calories * factor;
      totals.proteinG += src.proteinG * factor;
      totals.carbsG += src.carbsG * factor;
      totals.fatG += src.fatG * factor;
    }
    perServing = {
      calories: round1(totals.calories / payload.servings),
      proteinG: round1(totals.proteinG / payload.servings),
      carbsG: round1(totals.carbsG / payload.servings),
      fatG: round1(totals.fatG / payload.servings),
    };
    macroSource = "ingredient_calculated";
    macroConfidence = 0.8;
  } else {
    if (payload.calories == null || payload.proteinG == null || payload.carbsG == null || payload.fatG == null) {
      return { error: "Link every ingredient to a food, or enter per-serving macros manually." };
    }
    perServing = {
      calories: payload.calories,
      proteinG: payload.proteinG,
      carbsG: payload.carbsG,
      fatG: payload.fatG,
    };
  }

  const recipeId = await db.transaction(async (tx) => {
    const newPersonalIds = new Map<number, string>();
    for (let i = 0; i < payload.ingredients.length; i++) {
      const np = payload.ingredients[i].newPersonal;
      if (!np) continue;
      const [row] = await tx
        .insert(personalIngredients)
        .values({ userId: user.id, ...np })
        .returning({ id: personalIngredients.id });
      newPersonalIds.set(i, row.id);
    }

    const [recipe] = await tx
      .insert(recipes)
      .values({
        authorId: user.id,
        name: payload.name,
        description: payload.description || null,
        instructions: payload.instructions,
        servings: payload.servings,
        servingDesc: payload.servingDesc || null,
        ...perServing,
        macroSource,
        macroConfidence,
        prepMin: payload.prepMin ?? null,
        cookMin: payload.cookMin ?? null,
        difficulty: payload.difficulty ?? null,
        costCents: payload.costCents ?? null,
        tags: payload.tags,
      })
      .returning({ id: recipes.id });
    await tx.insert(recipeIngredients).values(
      payload.ingredients.map((ing, i) => ({
        recipeId: recipe.id,
        foodId: ing.foodId,
        personalIngredientId: ing.personalIngredientId ?? newPersonalIds.get(i) ?? null,
        rawText: ing.rawText,
        grams: ing.grams,
        position: i,
      })),
    );
    return recipe.id;
  });

  redirect(`/recipes/${recipeId}`);
}

// ─── interactions ────────────────────────────────────────────────────────────

async function reputationDelta(authorId: string, points: number) {
  await db
    .update(users)
    .set({ reputation: sql`GREATEST(0, ${users.reputation} + ${points})` })
    .where(eq(users.id, authorId));
}

export async function voteRecipe(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const recipeId = z.string().uuid().parse(formData.get("recipeId"));
  const value = z.coerce.number().refine((v) => v === 1 || v === -1).parse(formData.get("value")) as 1 | -1;

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) throw new Error("Recipe not found");
  if (recipe.authorId === user.id) return; // no self-votes

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "recipe"), eq(votes.subjectId, recipeId)));

    let up = 0;
    let down = 0;
    if (existing && existing.value === value) {
      // toggle off
      await tx
        .delete(votes)
        .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "recipe"), eq(votes.subjectId, recipeId)));
      value === 1 ? (up = -1) : (down = -1);
    } else if (existing) {
      await tx
        .update(votes)
        .set({ value })
        .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "recipe"), eq(votes.subjectId, recipeId)));
      if (value === 1) {
        up = 1;
        down = -1;
      } else {
        up = -1;
        down = 1;
      }
    } else {
      await tx.insert(votes).values({ userId: user.id, subjectType: "recipe", subjectId: recipeId, value });
      value === 1 ? (up = 1) : (down = 1);
    }
    await tx
      .update(recipes)
      .set({
        upvotes: sql`${recipes.upvotes} + ${up}`,
        downvotes: sql`${recipes.downvotes} + ${down}`,
      })
      .where(eq(recipes.id, recipeId));
  });
  await reputationDelta(recipe.authorId, value === 1 ? 2 : -1);
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}

export async function toggleSaveRecipe(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const recipeId = z.string().uuid().parse(formData.get("recipeId"));

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) throw new Error("Recipe not found");

  const where = and(eq(saves.userId, user.id), eq(saves.subjectType, "recipe"), eq(saves.subjectId, recipeId));
  const [existing] = await db.select().from(saves).where(where);
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(saves).where(where);
      await tx.update(recipes).set({ saveCount: sql`${recipes.saveCount} - 1` }).where(eq(recipes.id, recipeId));
    } else {
      await tx.insert(saves).values({ userId: user.id, subjectType: "recipe", subjectId: recipeId });
      await tx.update(recipes).set({ saveCount: sql`${recipes.saveCount} + 1` }).where(eq(recipes.id, recipeId));
    }
  });
  if (!existing && recipe.authorId !== user.id) await reputationDelta(recipe.authorId, 3);
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}

const reviewSchema = z.object({
  recipeId: z.string().uuid(),
  rating: z.coerce.number().min(1).max(5).optional(),
  body: z.string().max(500).optional(),
});

export async function reviewRecipe(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = reviewSchema.parse({
    recipeId: formData.get("recipeId"),
    rating: formData.get("rating") || undefined,
    body: formData.get("body") || undefined,
  });

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, d.recipeId)).limit(1);
  if (!recipe) throw new Error("Recipe not found");

  const where = and(eq(recipeReviews.recipeId, d.recipeId), eq(recipeReviews.userId, user.id));
  const [existing] = await db.select().from(recipeReviews).where(where);

  await db.transaction(async (tx) => {
    if (existing) {
      await tx.update(recipeReviews).set({ rating: d.rating ?? existing.rating, body: d.body ?? existing.body }).where(where);
      await tx
        .update(recipes)
        .set({
          ratingSum: sql`${recipes.ratingSum} - ${existing.rating ?? 0} + ${d.rating ?? existing.rating ?? 0}`,
          ratingCount: sql`${recipes.ratingCount} + ${existing.rating == null && d.rating != null ? 1 : 0}`,
        })
        .where(eq(recipes.id, d.recipeId));
    } else {
      await tx.insert(recipeReviews).values({ recipeId: d.recipeId, userId: user.id, rating: d.rating ?? null, body: d.body ?? null });
      await tx
        .update(recipes)
        .set({
          triedCount: sql`${recipes.triedCount} + 1`,
          ratingSum: sql`${recipes.ratingSum} + ${d.rating ?? 0}`,
          ratingCount: sql`${recipes.ratingCount} + ${d.rating != null ? 1 : 0}`,
        })
        .where(eq(recipes.id, d.recipeId));
    }
  });
  if (!existing && recipe.authorId !== user.id) await reputationDelta(recipe.authorId, 3);
  revalidatePath(`/recipes/${d.recipeId}`);
}
