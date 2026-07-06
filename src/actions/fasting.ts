"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { fastingWindows } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function startFast(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const targetHours = z.coerce.number().min(8).max(72).parse(formData.get("targetHours"));

  const activeWhere = and(eq(fastingWindows.userId, user.id), isNull(fastingWindows.endedAt));
  const [active] = await db.select({ id: fastingWindows.id }).from(fastingWindows).where(activeWhere).limit(1);
  if (!active) await db.insert(fastingWindows).values({ userId: user.id, targetHours });
  revalidatePath("/track");
}

export async function endFast() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db
    .update(fastingWindows)
    .set({ endedAt: new Date() })
    .where(and(eq(fastingWindows.userId, user.id), isNull(fastingWindows.endedAt)));
  revalidatePath("/track");
}

/** Started by mistake — remove instead of recording a zero-length fast. */
export async function discardFast() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await db
    .delete(fastingWindows)
    .where(and(eq(fastingWindows.userId, user.id), isNull(fastingWindows.endedAt)));
  revalidatePath("/track");
}
