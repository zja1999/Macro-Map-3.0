"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isMissingTableError } from "@/lib/dbErrors";

export async function markNotificationRead(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = z.string().uuid().parse(formData.get("notificationId"));

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id), isNull(notifications.readAt)));
  } catch (error) {
    if (!isMissingTableError(error, "notifications")) throw error;
  }
  revalidatePath("/notifications");
}

export async function markAllNotificationsRead() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
  } catch (error) {
    if (!isMissingTableError(error, "notifications")) throw error;
  }
  revalidatePath("/notifications");
}
