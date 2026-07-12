"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { badges, profiles, userBadges, users } from "@/db/schema";
import { BADGE_METRICS } from "@/lib/badges";
import { createNotifications } from "@/lib/notify";
import { assertAdmin } from "@/lib/permissions";

const iconSchema = z.string().trim().min(1, "Choose an icon").max(160_000).refine(
  (value) => !value.startsWith("data:") || /^data:image\/(png|jpeg|webp);base64,/.test(value),
  "Badge image must be PNG, JPG, or WebP",
);

const badgeSchema = z
  .object({
    name: z.string().trim().min(2).max(50),
    description: z.string().trim().min(2).max(240),
    icon: iconSchema,
    awardMode: z.enum(["manual", "automatic"]),
    metric: z.enum(Object.keys(BADGE_METRICS) as [keyof typeof BADGE_METRICS, ...(keyof typeof BADGE_METRICS)[]]).optional(),
    threshold: z.coerce.number().int().min(1).max(1_000_000).optional(),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.awardMode === "automatic" && (!value.metric || !value.threshold)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["metric"], message: "Automatic badges need a metric and threshold" });
    }
  });

function parseBadge(formData: FormData) {
  return badgeSchema.parse({
    name: formData.get("name"),
    description: formData.get("description"),
    icon: formData.get("icon"),
    awardMode: formData.get("awardMode"),
    metric: formData.get("metric") || undefined,
    threshold: formData.get("threshold") || undefined,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createBadge(formData: FormData) {
  const admin = await assertAdmin();
  const data = parseBadge(formData);
  await db.insert(badges).values({
    ...data,
    metric: data.awardMode === "automatic" ? data.metric : null,
    threshold: data.awardMode === "automatic" ? data.threshold : null,
    createdBy: admin.id,
  });
  revalidatePath("/admin/badges");
}

export async function updateBadge(formData: FormData) {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("badgeId"));
  const data = parseBadge(formData);
  await db
    .update(badges)
    .set({
      ...data,
      metric: data.awardMode === "automatic" ? data.metric : null,
      threshold: data.awardMode === "automatic" ? data.threshold : null,
      updatedAt: new Date(),
    })
    .where(eq(badges.id, id));
  revalidatePath("/admin/badges");
  revalidatePath("/");
}

export async function deleteBadge(formData: FormData) {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("badgeId"));
  await db.delete(badges).where(eq(badges.id, id));
  revalidatePath("/admin/badges");
  revalidatePath("/");
}

const assignmentSchema = z.object({
  badgeId: z.string().uuid(),
  target: z.string().trim().min(1).max(120),
});

async function findUser(target: string) {
  const [row] = await db
    .select({ userId: users.id, username: profiles.username, displayName: profiles.displayName })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(or(eq(users.email, target.toLowerCase()), eq(profiles.username, target.toLowerCase())))
    .limit(1);
  if (!row) throw new Error("User not found");
  return row;
}

export async function assignBadge(formData: FormData) {
  const admin = await assertAdmin();
  const data = assignmentSchema.parse({ badgeId: formData.get("badgeId"), target: formData.get("target") });
  const [badge, target] = await Promise.all([
    db.select().from(badges).where(eq(badges.id, data.badgeId)).limit(1).then((rows) => rows[0]),
    findUser(data.target),
  ]);
  if (!badge) throw new Error("Badge not found");
  const inserted = await db
    .insert(userBadges)
    .values({ userId: target.userId, badgeId: badge.id, awardedBy: admin.id, awardSource: "manual" })
    .onConflictDoNothing()
    .returning({ userId: userBadges.userId });
  if (inserted.length) {
    await createNotifications({
      userId: target.userId,
      actorId: admin.id,
      kind: "badge_awarded",
      subjectType: "badge",
      subjectId: badge.id,
      message: `You received the ${badge.name} badge`,
      href: `/u/${target.username}`,
    });
  }
  revalidatePath("/admin/badges");
  revalidatePath(`/u/${target.username}`);
}

export async function revokeBadge(formData: FormData) {
  await assertAdmin();
  const data = assignmentSchema.parse({ badgeId: formData.get("badgeId"), target: formData.get("target") });
  const target = await findUser(data.target);
  await db.delete(userBadges).where(and(eq(userBadges.userId, target.userId), eq(userBadges.badgeId, data.badgeId)));
  revalidatePath("/admin/badges");
  revalidatePath(`/u/${target.username}`);
}
