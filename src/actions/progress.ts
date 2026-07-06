"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { habitLogs, habits, mediaAttachments, nutritionTargets, photos, profiles, progressEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { calculateTargetsFromProfile } from "@/lib/targets";
import { weightToKg, lengthToCm } from "@/lib/units";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const habitEmojiSchema = z.string().trim().min(1).max(12).catch("✅");
const habitNameSchema = z.string().trim().min(2).max(50);

// raw values are in whichever unit the `units` field says — converted to
// canonical kg/cm below, before anything reaches the DB (docs: lib/units.ts)
const entrySchema = z.object({
  entryDate: z.string().regex(dateRe),
  units: z.enum(["metric", "imperial"]).default("metric"),
  weight: z.coerce.number().min(4).max(880).optional(),
  bodyFatPct: z.coerce.number().min(1).max(75).optional(),
  waist: z.coerce.number().min(4).max(250).optional(),
  chest: z.coerce.number().min(4).max(250).optional(),
  hips: z.coerce.number().min(4).max(250).optional(),
  arms: z.coerce.number().min(4).max(250).optional(),
  note: z.string().max(300).optional(),
});

export async function saveProgressEntry(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.weight == null && d.bodyFatPct == null && d.waist == null && d.chest == null && d.hips == null && d.arms == null) {
    return { error: "Enter at least one measurement" };
  }
  const weightKg = d.weight != null ? weightToKg(d.weight, d.units) : undefined;
  const waistCm = d.waist != null ? lengthToCm(d.waist, d.units) : undefined;
  const chestCm = d.chest != null ? lengthToCm(d.chest, d.units) : undefined;
  const hipsCm = d.hips != null ? lengthToCm(d.hips, d.units) : undefined;
  const armsCm = d.arms != null ? lengthToCm(d.arms, d.units) : undefined;
  if (weightKg != null && (weightKg < 20 || weightKg > 400)) return { error: "Weight out of range" };
  if ([waistCm, chestCm, hipsCm, armsCm].some((v) => v != null && (v < 10 || v > 250))) {
    return { error: "Measurement out of range" };
  }

  // one entry per day: update today's row if it exists
  const [existing] = await db
    .select()
    .from(progressEntries)
    .where(and(eq(progressEntries.userId, user.id), eq(progressEntries.entryDate, d.entryDate)))
    .limit(1);
  if (existing) {
    await db
      .update(progressEntries)
      .set({
        weightKg: weightKg ?? existing.weightKg,
        bodyFatPct: d.bodyFatPct ?? existing.bodyFatPct,
        waistCm: waistCm ?? existing.waistCm,
        chestCm: chestCm ?? existing.chestCm,
        hipsCm: hipsCm ?? existing.hipsCm,
        armsCm: armsCm ?? existing.armsCm,
        note: d.note ?? existing.note,
      })
      .where(eq(progressEntries.id, existing.id));
  } else {
    await db.insert(progressEntries).values({
      userId: user.id,
      entryDate: d.entryDate,
      weightKg,
      bodyFatPct: d.bodyFatPct,
      waistCm,
      chestCm,
      hipsCm,
      armsCm,
      note: d.note,
    });
  }

  if (weightKg != null && !user.targets?.isManual) {
    const targets = calculateTargetsFromProfile(user.profile, weightKg);
    if (targets) {
      await db.transaction(async (tx) => {
        await tx.update(profiles).set({ weightKg }).where(eq(profiles.userId, user.id));
        await tx.insert(nutritionTargets).values({ userId: user.id, ...targets, isManual: false });
      });
      revalidatePath("/track");
      revalidatePath("/restaurants");
      revalidatePath("/settings");
    }
  }

  revalidatePath("/progress");
  return {};
}

const photoSchema = z.object({
  entryDate: z.string().regex(dateRe),
  storageKey: z.string().min(3).max(300),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  width: z.coerce.number().int().min(1).max(10000).optional(),
  height: z.coerce.number().int().min(1).max(10000).optional(),
});

export async function recordProgressPhoto(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = photoSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(progressEntries)
      .where(and(eq(progressEntries.userId, user.id), eq(progressEntries.entryDate, d.entryDate)))
      .limit(1);
    const entry =
      existing ??
      (
        await tx
          .insert(progressEntries)
          .values({ userId: user.id, entryDate: d.entryDate })
          .returning()
      )[0];
    const [photo] = await tx
      .insert(photos)
      .values({
        userId: user.id,
        storageKey: d.storageKey,
        mimeType: d.mimeType,
        purpose: "progress",
        width: d.width ?? null,
        height: d.height ?? null,
        isPrivate: true,
      })
      .returning({ id: photos.id });
    await tx.insert(mediaAttachments).values({
      photoId: photo.id,
      subjectType: "progress_entry",
      subjectId: entry.id,
    });
  });
  revalidatePath("/progress");
  return { ok: true };
}

export async function toggleHabit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const habitId = z.string().uuid().parse(formData.get("habitId"));
  const logDate = z.string().regex(dateRe).parse(formData.get("logDate"));

  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)))
    .limit(1);
  if (!habit) throw new Error("Habit not found");

  const where = and(eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate));
  const [existing] = await db.select().from(habitLogs).where(where);
  if (existing) await db.delete(habitLogs).where(where);
  else await db.insert(habitLogs).values({ habitId, logDate });
  revalidatePath("/progress");
}

export async function addHabit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const name = habitNameSchema.parse(formData.get("name"));
  const emoji = habitEmojiSchema.parse(formData.get("emoji") || "✅");

  const existing = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.userId, user.id), eq(habits.archived, false)));
  if (existing.length >= 12) return; // sanity cap
  await db.insert(habits).values({ userId: user.id, name, emoji });
  revalidatePath("/progress");
}

export async function updateHabit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const habitId = z.string().uuid().parse(formData.get("habitId"));
  const name = habitNameSchema.parse(formData.get("name"));
  const emoji = habitEmojiSchema.parse(formData.get("emoji") || "✅");

  await db
    .update(habits)
    .set({ name, emoji })
    .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)));
  revalidatePath("/progress");
}

export async function archiveHabit(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const habitId = z.string().uuid().parse(formData.get("habitId"));
  await db
    .update(habits)
    .set({ archived: true })
    .where(and(eq(habits.id, habitId), eq(habits.userId, user.id)));
  revalidatePath("/progress");
}

/** Seeds the default habit set (docs/08 §1b) lazily on first Progress visit. */
export async function ensureDefaultHabits(userId: string) {
  const defaults = [
    { name: "Hit protein goal", emoji: "🍗" },
    { name: "Drink 2L water", emoji: "💧" },
    { name: "Move today", emoji: "🏃" },
    { name: "Eat veggies", emoji: "🥦" },
  ];
  const existing = await db.select({ id: habits.id }).from(habits).where(eq(habits.userId, userId)).limit(1);
  if (existing.length) return;
  await db.insert(habits).values(defaults.map((h) => ({ userId, ...h, isDefault: true })));
}
