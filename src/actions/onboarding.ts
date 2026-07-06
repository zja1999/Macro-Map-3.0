"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles, nutritionTargets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { calculateTargets, CALORIE_FLOOR } from "@/lib/targets";
import { ftInToCm, weightToKg } from "@/lib/units";

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
  revalidatePath("/settings");
  revalidatePath("/track");
  revalidatePath("/restaurants");
  return { ok: true };
}

const biometricsSchema = z.object({
  goal: schema.shape.goal,
  trackingStyle: schema.shape.trackingStyle,
  sex: schema.shape.sex,
  units: z.enum(["metric", "imperial"]),
  weight: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive().optional(),
  heightFt: z.coerce.number().int().min(3).max(8).optional(),
  heightIn: z.coerce.number().min(0).max(11.9).optional(),
  age: schema.shape.age,
  activityLevel: schema.shape.activityLevel,
});

export async function updateBiometrics(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = biometricsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const weightKg = weightToKg(d.weight, d.units);
  const heightCm =
    d.units === "imperial"
      ? ftInToCm(d.heightFt ?? 0, d.heightIn ?? 0)
      : d.heightCm;

  if (weightKg < 30 || weightKg > 300) return { error: "Weight is outside the supported range." };
  if (heightCm == null || heightCm < 100 || heightCm > 250) {
    return { error: "Height is outside the supported range." };
  }

  const targets = calculateTargets({
    sex: d.sex,
    weightKg,
    heightCm,
    age: d.age,
    activityLevel: d.activityLevel,
    goal: d.goal,
  });

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        goal: d.goal,
        trackingStyle: d.trackingStyle,
        sex: d.sex,
        weightKg,
        heightCm,
        birthYear: new Date().getFullYear() - d.age,
        activityLevel: d.activityLevel,
      })
      .where(eq(profiles.userId, user.id));
    await tx.insert(nutritionTargets).values({ userId: user.id, ...targets, isManual: false });
  });

  revalidatePath("/settings");
  revalidatePath("/track");
  revalidatePath("/restaurants");
  revalidatePath("/progress");
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
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}

// Profile picture. No external media pipeline yet, so we store a small resized
// data URL directly (the client canvas-resizes to ~256px before submitting).
// Cap the payload so it can't bloat rows or feed HTML; empty string clears it.
const MAX_AVATAR_CHARS = 260_000; // ~190KB of base64
const avatarSchema = z
  .string()
  .max(MAX_AVATAR_CHARS)
  .refine((s) => s === "" || /^data:image\/(png|jpeg|webp);base64,/.test(s), "Invalid image");

export async function updateAvatar(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = avatarSchema.safeParse(formData.get("avatar") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid image" };

  await db
    .update(profiles)
    .set({ avatarUrl: parsed.data === "" ? null : parsed.data })
    .where(eq(profiles.userId, user.id));
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath(`/u/${user.profile.username}`);
  return { ok: true };
}
