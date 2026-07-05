"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { habitLogs, habits, mediaAttachments, photos, progressEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const entrySchema = z.object({
  entryDate: z.string().regex(dateRe),
  weightKg: z.coerce.number().min(20).max(400).optional(),
  bodyFatPct: z.coerce.number().min(1).max(75).optional(),
  waistCm: z.coerce.number().min(30).max(250).optional(),
  chestCm: z.coerce.number().min(30).max(250).optional(),
  hipsCm: z.coerce.number().min(30).max(250).optional(),
  armsCm: z.coerce.number().min(10).max(80).optional(),
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
  if (d.weightKg == null && d.bodyFatPct == null && d.waistCm == null && d.chestCm == null && d.hipsCm == null && d.armsCm == null) {
    return { error: "Enter at least one measurement" };
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
        weightKg: d.weightKg ?? existing.weightKg,
        bodyFatPct: d.bodyFatPct ?? existing.bodyFatPct,
        waistCm: d.waistCm ?? existing.waistCm,
        chestCm: d.chestCm ?? existing.chestCm,
        hipsCm: d.hipsCm ?? existing.hipsCm,
        armsCm: d.armsCm ?? existing.armsCm,
        note: d.note ?? existing.note,
      })
      .where(eq(progressEntries.id, existing.id));
  } else {
    await db.insert(progressEntries).values({ userId: user.id, ...d });
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
  const name = z.string().min(2).max(50).parse(formData.get("name"));
  const emoji = z.string().max(4).catch("✅").parse(formData.get("emoji") || "✅");

  const existing = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.userId, user.id), eq(habits.archived, false)));
  if (existing.length >= 12) return; // sanity cap
  await db.insert(habits).values({ userId: user.id, name, emoji });
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
