"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { challenges, groups, moderationActions, reports, sessions, users } from "@/db/schema";
import { assertAdmin, canManageUser } from "@/lib/permissions";

/* Admin-only user management (docs/07). Every action is audit-logged to
 * moderation_actions with subjectType 'user'. Guard rules live in canManageUser:
 * you can never act on yourself or on someone of equal/higher rank. */

async function loadTarget(userId: string) {
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new Error("User not found");
  return target;
}

async function audit(actorId: string, kind: string, userId: string, reason: string) {
  await db.insert(moderationActions).values({ actorId, kind, subjectType: "user", subjectId: userId, reason });
}

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["user", "moderator", "admin"]),
});

export async function setUserRole(formData: FormData) {
  const admin = await assertAdmin();
  const d = roleSchema.parse({ userId: formData.get("userId"), role: formData.get("role") });
  const target = await loadTarget(d.userId);
  // must out-rank the target's CURRENT role (so admins can't reassign each other)
  if (!canManageUser(admin, target)) throw new Error("You can't change this user's role");

  await db.update(users).set({ role: d.role }).where(eq(users.id, target.id));
  await audit(admin.id, "set_role", target.id, `role ${target.role} → ${d.role}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

const banSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

export async function banUser(formData: FormData) {
  const admin = await assertAdmin();
  const d = banSchema.parse({ userId: formData.get("userId"), reason: formData.get("reason") || undefined });
  const target = await loadTarget(d.userId);
  if (!canManageUser(admin, target)) throw new Error("You can't suspend this user");

  await db.transaction(async (tx) => {
    await tx.update(users).set({ bannedAt: new Date(), bannedReason: d.reason ?? null }).where(eq(users.id, target.id));
    // kill active sessions so the suspension takes effect immediately
    await tx.delete(sessions).where(eq(sessions.userId, target.id));
  });
  await audit(admin.id, "ban_user", target.id, d.reason ? `suspended: ${d.reason}` : "suspended");
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function unbanUser(formData: FormData) {
  const admin = await assertAdmin();
  const userId = z.string().uuid().parse(formData.get("userId"));
  const target = await loadTarget(userId);
  if (!canManageUser(admin, target)) throw new Error("You can't unsuspend this user");
  await db.update(users).set({ bannedAt: null, bannedReason: null }).where(eq(users.id, target.id));
  await audit(admin.id, "unban_user", target.id, "suspension lifted");
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function deleteUser(formData: FormData) {
  const admin = await assertAdmin();
  const userId = z.string().uuid().parse(formData.get("userId"));
  const target = await loadTarget(userId);
  if (!canManageUser(admin, target)) throw new Error("You can't delete this user");
  // only plain users can be hard-deleted — a privileged account may own audit-log
  // entries (as actor/reviewer) that a cascade delete would orphan; demote first.
  if (target.role !== "user") throw new Error("Demote this user to 'user' before deleting");

  await db.transaction(async (tx) => {
    const userReports = await tx.select({ id: reports.id }).from(reports).where(eq(reports.reporterId, target.id));
    if (userReports.length) {
      await tx
        .update(moderationActions)
        .set({ reportId: null })
        .where(inArray(moderationActions.reportId, userReports.map((r) => r.id)));
    }

    // groups.createdBy and challenges.createdBy have no ON DELETE rule (they
    // RESTRICT), so remove content this user authored before the cascade runs.
    // Deleting a group cascades its members, group-scoped challenges, and their
    // participants; deleting standalone challenges cascades their participants.
    await tx.delete(challenges).where(eq(challenges.createdBy, target.id));
    await tx.delete(groups).where(eq(groups.createdBy, target.id));

    await tx.insert(moderationActions).values({
      actorId: admin.id,
      kind: "delete_user",
      subjectType: "user",
      subjectId: target.id,
      reason: `deleted account @${target.id}`,
    });
    await tx.delete(users).where(eq(users.id, target.id));
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}
