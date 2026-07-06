"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles, nutritionTargets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { calculateTargets, CALORIE_FLOOR } from "@/lib/targets";

const schema = z.object({
  goal: z.enum(["fat_loss", "muscle_gain", "maintenance", "recomp", "performance", "general_health", "custom"]),
  trackingStyle: z.enum(["strict_macro", "calorie_only", "protein_focused", "habit", "maintenance", "performance", "no_scale"]),
  sex: z.enum(["male", "female"]),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(30).max(300),
  units: z.enum(["metric", "imperial"]).default("imperial"),
  age: z.coerce.number().min(13).max(100),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very", "extra"]),
  dietaryStyle: z.string().max(40).optional(),
  // manual overrides (advanced users)
  manual: z.coerce.boolean().optional(),
  calories: z.coerce.number().optional(),
  proteinG: z.coerce.number().optional(),
  carbsG: z.coerce.number().optional(),
  fatG: z.coerce.number().optional(),
});

export async function completeOnboarding(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let targets = calculateTargets({
    sex: d.sex,
    weightKg: d.weightKg,
    heightCm: d.heightCm,
    age: d.age,
    activityLevel: d.activityLevel,
    goal: d.goal,
  });
  let isManual = false;
  if (d.manual && d.calories && d.proteinG != null && d.carbsG != null && d.fatG != null) {
    if (d.calories < CALORIE_FLOOR) {
      return { error: `For safety, calorie targets can't be set below ${CALORIE_FLOOR}.` };
    }
    targets = { calories: d.calories, proteinG: d.proteinG, carbsG: d.carbsG, fatG: d.fatG };
    isManual = true;
  }

  await db
    .update(profiles)
    .set({
      goal: d.goal,
      trackingStyle: d.trackingStyle,
      sex: d.sex,
      heightCm: d.heightCm,
      weightKg: d.weightKg,
      units: d.units,
      birthYear: new Date().getFullYear() - d.age,
      activityLevel: d.activityLevel,
      dietaryStyle: d.dietaryStyle || null,
      onboardedAt: new Date(),
    })
    .where(eq(profiles.userId, user.id));

  await db.insert(nutritionTargets).values({ userId: user.id, ...targets, isManual });
  redirect("/");
}

const targetsSchema = z.object({
  calories: z.coerce.number().min(CALORIE_FLOOR).max(10000),
  proteinG: z.coerce.number().min(0).max(500),
  carbsG: z.coerce.number().min(0).max(1000),
  fatG: z.coerce.number().min(0).max(500),
});

export async function updateTargets(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = targetsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: `Check your numbers — calories must be at least ${CALORIE_FLOOR}.` };
  }
  await db.insert(nutritionTargets).values({ userId: user.id, ...parsed.data, isManual: true });
  return { ok: true };
}

const profileSchema = z.object({
  displayName: z.string().min(1).max(40),
  bio: z.string().max(280).optional(),
  dietaryStyle: z.string().max(40).optional(),
  shareMacroGoals: z.coerce.boolean().optional(),
  units: z.enum(["metric", "imperial"]).optional(),
});

export async function updateProfile(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db
    .update(profiles)
    .set({
      displayName: parsed.data.displayName,
      bio: parsed.data.bio || null,
      dietaryStyle: parsed.data.dietaryStyle || null,
      shareMacroGoals: parsed.data.shareMacroGoals ?? false,
      ...(parsed.data.units ? { units: parsed.data.units } : {}),
    })
    .where(eq(profiles.userId, user.id));
  return { ok: true };
}
