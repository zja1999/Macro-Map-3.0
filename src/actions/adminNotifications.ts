"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  appSettings,
  groupMembers,
  groups,
  notificationBroadcasts,
  profiles,
  users,
} from "@/db/schema";
import { createNotifications } from "@/lib/notify";
import { assertAdmin } from "@/lib/permissions";
import { WELCOME_SETTING_KEYS } from "@/lib/welcomeNotification";

const internalHref = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value.startsWith("/") && !value.startsWith("//"), "Use an internal path beginning with /");

const welcomeSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(1000),
  href: internalHref,
});

export async function updateWelcomeNotification(formData: FormData) {
  const admin = await assertAdmin();
  const data = welcomeSchema.parse({
    enabled: formData.get("enabled") === "on",
    title: formData.get("title"),
    message: formData.get("message"),
    href: formData.get("href"),
  });
  const values = [
    [WELCOME_SETTING_KEYS.enabled, String(data.enabled)],
    [WELCOME_SETTING_KEYS.title, data.title],
    [WELCOME_SETTING_KEYS.message, data.message],
    [WELCOME_SETTING_KEYS.href, data.href],
  ] as const;
  await db.transaction(async (tx) => {
    for (const [key, value] of values) {
      await tx
        .insert(appSettings)
        .values({ key, value, updatedBy: admin.id, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: admin.id, updatedAt: new Date() } });
    }
  });
  revalidatePath("/admin/notifications");
}

const broadcastSchema = z.object({
  targetType: z.enum(["user", "group", "site"]),
  target: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(1000),
  href: internalHref,
});

export async function sendAdminNotification(formData: FormData) {
  const admin = await assertAdmin();
  const data = broadcastSchema.parse({
    targetType: formData.get("targetType"),
    target:
      formData.get("targetType") === "group"
        ? formData.get("targetGroup") || undefined
        : formData.get("targetUser") || undefined,
    title: formData.get("title"),
    message: formData.get("message"),
    href: formData.get("href"),
  });

  let targetId: string | null = null;
  let recipients: { userId: string }[] = [];
  if (data.targetType === "user") {
    if (!data.target) throw new Error("Enter a username or email");
    const [target] = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(and(isNull(users.bannedAt), data.target.includes("@") ? eq(users.email, data.target.toLowerCase()) : eq(profiles.username, data.target.toLowerCase())))
      .limit(1);
    if (!target) throw new Error("User not found");
    targetId = target.userId;
    recipients = [target];
  } else if (data.targetType === "group") {
    if (!data.target) throw new Error("Choose a group");
    const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.id, z.string().uuid().parse(data.target))).limit(1);
    if (!group) throw new Error("Group not found");
    targetId = group.id;
    recipients = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId))
      .where(and(eq(groupMembers.groupId, group.id), isNull(users.bannedAt)));
  } else {
    recipients = await db.select({ userId: users.id }).from(users).where(isNull(users.bannedAt));
  }
  if (!recipients.length) throw new Error("This audience has no eligible recipients");

  const message = `${data.title}: ${data.message}`;
  await createNotifications(
    recipients.map(({ userId }) => ({ userId, actorId: admin.id, kind: "admin_message", message, href: data.href })),
  );
  await db.insert(notificationBroadcasts).values({
    sentBy: admin.id,
    targetType: data.targetType,
    targetId,
    title: data.title,
    message: data.message,
    href: data.href,
    recipientCount: recipients.length,
  });
  revalidatePath("/notifications");
  revalidatePath("/admin/notifications");
}
