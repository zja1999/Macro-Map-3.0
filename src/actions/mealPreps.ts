"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { mealPrepItems, mealPrepPlans, recipes, saves, users, votes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { round1 } from "@/lib/utils";

const createSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  daysCovered: z.coerce.number().min(1).max(14).optional(),
  storageNotes: z.string().max(300).optional(),
  // [{recipeId, servings}] — servings = how many servings of that recipe the plan uses
  items: z
    .array(z.object({ recipeId: z.string().uuid(), servings: z.number().min(0.5).max(50) }))
    .min(1)
    .max(12),
});

export async function createMealPrepPlan(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let d: z.infer<typeof createSchema>;
  try {
    d = createSchema.parse({
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      daysCovered: formData.get("daysCovered") || undefined,
      storageNotes: formData.get("storageNotes") || undefined,
      items: JSON.parse(String(formData.get("items") ?? "[]")),
    });
  } catch {
    return { error: "Add a title and at least one recipe." };
  }

  // plan-level macros/cost derive from member recipes (docs/06 §6)
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(inArray(recipes.id, d.items.map((i) => i.recipeId)));
  if (recipeRows.length !== new Set(d.items.map((i) => i.recipeId)).size) return { error: "Recipe not found" };
  const byId = new Map(recipeRows.map((r) => [r.id, r]));

  const totalServings = d.items.reduce((a, i) => a + i.servings, 0);
  const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, costCents: 0 };
  for (const item of d.items) {
    const r = byId.get(item.recipeId)!;
    totals.calories += r.calories * item.servings;
    totals.proteinG += r.proteinG * item.servings;
    totals.carbsG += r.carbsG * item.servings;
    totals.fatG += r.fatG * item.servings;
    totals.costCents += (r.costCents ?? 0) * item.servings;
  }
  const per = (n: number) => round1(n / Math.max(1, totalServings));

  const planId = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(mealPrepPlans)
      .values({
        authorId: user.id,
        title: d.title,
        description: d.description ?? null,
        daysCovered: d.daysCovered ?? null,
        totalServings: Math.round(totalServings),
        goal: user.profile.goal,
        calories: per(totals.calories),
        proteinG: per(totals.proteinG),
        carbsG: per(totals.carbsG),
        fatG: per(totals.fatG),
        costPerServingCents: totals.costCents > 0 ? Math.round(totals.costCents / totalServings) : null,
        storageNotes: d.storageNotes ?? null,
      })
      .returning({ id: mealPrepPlans.id });
    await tx.insert(mealPrepItems).values(
      d.items.map((item, i) => ({ planId: plan.id, recipeId: item.recipeId, servings: item.servings, position: i })),
    );
    return plan.id;
  });
  redirect(`/meal-prep/${planId}`);
}

// same one-primitive vote/save machinery as recipes (docs/08 §5.1)

export async function votePlan(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const planId = z.string().uuid().parse(formData.get("planId"));
  const value = z.coerce.number().refine((v) => v === 1 || v === -1).parse(formData.get("value")) as 1 | -1;

  const [plan] = await db.select().from(mealPrepPlans).where(eq(mealPrepPlans.id, planId)).limit(1);
  if (!plan) throw new Error("Plan not found");
  if (plan.authorId === user.id) return;

  await db.transaction(async (tx) => {
    const where = and(eq(votes.userId, user.id), eq(votes.subjectType, "meal_prep_plan"), eq(votes.subjectId, planId));
    const [existing] = await tx.select().from(votes).where(where);
    let up = 0;
    let down = 0;
    if (existing && existing.value === value) {
      await tx.delete(votes).where(where);
      value === 1 ? (up = -1) : (down = -1);
    } else if (existing) {
      await tx.update(votes).set({ value }).where(where);
      up = value === 1 ? 1 : -1;
      down = value === 1 ? -1 : 1;
    } else {
      await tx.insert(votes).values({ userId: user.id, subjectType: "meal_prep_plan", subjectId: planId, value });
      value === 1 ? (up = 1) : (down = 1);
    }
    await tx
      .update(mealPrepPlans)
      .set({ upvotes: sql`${mealPrepPlans.upvotes} + ${up}`, downvotes: sql`${mealPrepPlans.downvotes} + ${down}` })
      .where(eq(mealPrepPlans.id, planId));
  });
  await db
    .update(users)
    .set({ reputation: sql`GREATEST(0, ${users.reputation} + ${value === 1 ? 2 : -1})` })
    .where(eq(users.id, plan.authorId));
  revalidatePath(`/meal-prep/${planId}`);
  revalidatePath("/meal-prep");
}

export async function toggleSavePlan(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const planId = z.string().uuid().parse(formData.get("planId"));

  const [plan] = await db.select().from(mealPrepPlans).where(eq(mealPrepPlans.id, planId)).limit(1);
  if (!plan) throw new Error("Plan not found");

  const where = and(eq(saves.userId, user.id), eq(saves.subjectType, "meal_prep_plan"), eq(saves.subjectId, planId));
  const [existing] = await db.select().from(saves).where(where);
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(saves).where(where);
      await tx
        .update(mealPrepPlans)
        .set({ saveCount: sql`${mealPrepPlans.saveCount} - 1` })
        .where(eq(mealPrepPlans.id, planId));
    } else {
      await tx.insert(saves).values({ userId: user.id, subjectType: "meal_prep_plan", subjectId: planId });
      await tx
        .update(mealPrepPlans)
        .set({ saveCount: sql`${mealPrepPlans.saveCount} + 1` })
        .where(eq(mealPrepPlans.id, planId));
    }
  });
  if (!existing && plan.authorId !== user.id) {
    await db.update(users).set({ reputation: sql`${users.reputation} + 3` }).where(eq(users.id, plan.authorId));
  }
  revalidatePath(`/meal-prep/${planId}`);
  revalidatePath("/meal-prep");
}
