"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { sleepLogs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const sleepSchema = z.object({
  sleepDate: z.string().regex(dateRe), // the morning you woke up
  bedTime: z.string().regex(timeRe),
  wakeTime: z.string().regex(timeRe),
  quality: z.coerce.number().int().min(1).max(5).optional(),
});

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

export async function logSleep(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const d = sleepSchema.parse(raw);

  // bed time at/after wake time means bed was the previous evening
  let durationMin = toMin(d.wakeTime) - toMin(d.bedTime);
  if (durationMin <= 0) durationMin += 24 * 60;

  await db
    .insert(sleepLogs)
    .values({
      userId: user.id,
      sleepDate: d.sleepDate,
      bedTime: d.bedTime,
      wakeTime: d.wakeTime,
      durationMin,
      quality: d.quality ?? null,
    })
    .onConflictDoUpdate({
      target: [sleepLogs.userId, sleepLogs.sleepDate],
      set: { bedTime: d.bedTime, wakeTime: d.wakeTime, durationMin, quality: d.quality ?? null, source: "manual" },
    });
  revalidatePath("/progress");
}

export async function deleteSleepLog(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sleepDate = z.string().regex(dateRe).parse(formData.get("sleepDate"));
  await db.delete(sleepLogs).where(and(eq(sleepLogs.userId, user.id), eq(sleepLogs.sleepDate, sleepDate)));
  revalidatePath("/progress");
}
