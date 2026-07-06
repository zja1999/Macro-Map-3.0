"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { challenges, comments, contentWarnings, groups, moderationActions, posts, recipes, reports } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { assertModerator } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rateLimit";

const REASONS = [
  "inaccurate_macros",
  "unsafe_advice",
  "harassment",
  "body_shaming",
  "ed_content",
  "spam",
  "stolen_content",
  "fake_transformation",
  "medical_claim",
  "other",
] as const;

// safety reasons jump the queue and count toward auto-hide (docs/07 §2)
const SAFETY_REASONS = ["ed_content", "unsafe_advice", "harassment", "body_shaming"];

const reportSchema = z.object({
  subjectType: z.enum(["post", "recipe", "comment"]),
  subjectId: z.string().uuid(),
  reason: z.enum(REASONS),
  detail: z.string().max(500).optional(),
});

export async function submitReport(
  _prev: { error?: string; ok?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = reportSchema.safeParse({
    subjectType: formData.get("subjectType"),
    subjectId: formData.get("subjectId"),
    reason: formData.get("reason"),
    detail: formData.get("detail") || undefined,
  });
  if (!parsed.success) return { error: "Pick a reason." };
  const d = parsed.data;

  const rateError = await checkRateLimit(user.id, "report", user.reputation);
  if (rateError) return { error: rateError };

  const dupe = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, user.id),
        eq(reports.subjectType, d.subjectType),
        eq(reports.subjectId, d.subjectId),
        eq(reports.status, "open"),
      ),
    )
    .limit(1);
  if (dupe[0]) return { ok: true }; // already reported — don't double-count

  await db.insert(reports).values({ reporterId: user.id, ...d });

  // Auto-mitigation: ≥3 unique safety reports in 24h soft-hides pending review.
  // inaccurate_macros never hides — it lowers confidence instead (docs/07 §2.3).
  if (SAFETY_REASONS.includes(d.reason) && d.subjectType === "post") {
    const [row] = await db
      .select({ n: sql<number>`COUNT(DISTINCT ${reports.reporterId})` })
      .from(reports)
      .where(
        and(
          eq(reports.subjectType, "post"),
          eq(reports.subjectId, d.subjectId),
          gte(reports.createdAt, new Date(Date.now() - 24 * 3600_000)),
        ),
      );
    if (Number(row.n) >= 3) {
      await db.update(posts).set({ isRemoved: true }).where(eq(posts.id, d.subjectId));
      await db.insert(moderationActions).values({
        actorId: user.id,
        kind: "auto_hide",
        subjectType: "post",
        subjectId: d.subjectId,
        reason: `auto-hidden: 3+ unique ${d.reason} reports in 24h, pending review`,
      });
    }
  }

  if (d.reason === "inaccurate_macros" && d.subjectType === "recipe") {
    await db
      .update(recipes)
      .set({ macroConfidence: sql`GREATEST(0.05, ${recipes.macroConfidence} - 0.10)` })
      .where(eq(recipes.id, d.subjectId));
  }

  return { ok: true };
}

// ─── admin/mod queue resolution — every action lands in the audit log ────────

const resolveSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["dismiss", "remove", "warn_label"]),
  warningKind: z.enum(["misinformation", "unsafe_diet", "unverified_macros"]).optional(),
  note: z.string().max(300).optional(),
});

export async function resolveReport(formData: FormData) {
  const user = await assertModerator();

  const d = resolveSchema.parse({
    reportId: formData.get("reportId"),
    action: formData.get("action"),
    warningKind: formData.get("warningKind") || undefined,
    note: formData.get("note") || undefined,
  });

  const [report] = await db.select().from(reports).where(eq(reports.id, d.reportId)).limit(1);
  if (!report || report.status !== "open") return;

  await db.transaction(async (tx) => {
    if (d.action === "remove") {
      if (report.subjectType === "post") {
        await tx.update(posts).set({ isRemoved: true }).where(eq(posts.id, report.subjectId));
      } else if (report.subjectType === "recipe") {
        await tx.update(recipes).set({ status: "removed" }).where(eq(recipes.id, report.subjectId));
      } else if (report.subjectType === "comment") {
        const [comment] = await tx.select().from(comments).where(eq(comments.id, report.subjectId));
        if (comment) {
          await tx.delete(comments).where(eq(comments.id, comment.id));
          if (comment.subjectType === "post") {
            await tx
              .update(posts)
              .set({ commentCount: sql`GREATEST(0, ${posts.commentCount} - 1)` })
              .where(eq(posts.id, comment.subjectId));
          }
        }
      }
    }
    if (d.action === "warn_label") {
      await tx
        .insert(contentWarnings)
        .values({
          subjectType: report.subjectType,
          subjectId: report.subjectId,
          kind: d.warningKind ?? "misinformation",
          note: d.note ?? null,
          addedBy: user.id,
        })
        .onConflictDoNothing();
    }
    await tx
      .update(reports)
      .set({ status: d.action === "dismiss" ? "dismissed" : "actioned", reviewedBy: user.id, reviewedAt: new Date() })
      .where(eq(reports.id, d.reportId));
    await tx.insert(moderationActions).values({
      actorId: user.id,
      kind: d.action === "dismiss" ? "dismiss_report" : d.action === "remove" ? "remove_content" : "add_warning_label",
      subjectType: report.subjectType,
      subjectId: report.subjectId,
      reportId: report.id,
      reason: d.note ?? `resolved ${report.reason} report`,
    });
  });
  revalidatePath("/admin/reports");
}

// ─── proactive moderation — act on any content, no report required (docs/07) ──

const moderateSchema = z.object({
  subjectType: z.enum(["post", "recipe", "comment"]),
  subjectId: z.string().uuid(),
  // hide = reversible soft-hide (posts/recipes); delete = permanent; restore = un-hide;
  // warn = attach a community warning label. Comments have no soft state → use delete.
  action: z.enum(["hide", "restore", "delete", "warn"]),
  warningKind: z.enum(["misinformation", "unsafe_diet", "unverified_macros"]).optional(),
  note: z.string().max(300).optional(),
  path: z.string().max(200).optional(), // page to revalidate (the surface the mod acted from)
});

export async function moderateContent(formData: FormData) {
  const actor = await assertModerator();
  const d = moderateSchema.parse({
    subjectType: formData.get("subjectType"),
    subjectId: formData.get("subjectId"),
    action: formData.get("action"),
    warningKind: formData.get("warningKind") || undefined,
    note: formData.get("note") || undefined,
    path: formData.get("path") || undefined,
  });

  await db.transaction(async (tx) => {
    if (d.action === "warn") {
      await tx
        .insert(contentWarnings)
        .values({
          subjectType: d.subjectType,
          subjectId: d.subjectId,
          kind: d.warningKind ?? "misinformation",
          note: d.note ?? null,
          addedBy: actor.id,
        })
        .onConflictDoNothing();
    } else if (d.action === "delete") {
      // hard delete — mirrors the author self-delete convention (polymorphic
      // children are left unreferenced, never re-queried once the parent is gone)
      if (d.subjectType === "post") await tx.delete(posts).where(eq(posts.id, d.subjectId));
      else if (d.subjectType === "recipe") await tx.delete(recipes).where(eq(recipes.id, d.subjectId));
      else if (d.subjectType === "comment") {
        const [c] = await tx.select().from(comments).where(eq(comments.id, d.subjectId));
        if (c) {
          await tx.delete(comments).where(eq(comments.id, c.id));
          if (c.subjectType === "post") {
            await tx
              .update(posts)
              .set({ commentCount: sql`GREATEST(0, ${posts.commentCount} - 1)` })
              .where(eq(posts.id, c.subjectId));
          }
        }
      }
    } else {
      // hide / restore — soft state on posts and recipes; comments have none
      const removed = d.action === "hide";
      if (d.subjectType === "post") {
        await tx.update(posts).set({ isRemoved: removed }).where(eq(posts.id, d.subjectId));
      } else if (d.subjectType === "recipe") {
        await tx.update(recipes).set({ status: removed ? "removed" : "published" }).where(eq(recipes.id, d.subjectId));
      } else if (d.subjectType === "comment" && removed) {
        // no soft-hide for comments → hide means delete
        const [c] = await tx.select().from(comments).where(eq(comments.id, d.subjectId));
        if (c) {
          await tx.delete(comments).where(eq(comments.id, c.id));
          if (c.subjectType === "post") {
            await tx
              .update(posts)
              .set({ commentCount: sql`GREATEST(0, ${posts.commentCount} - 1)` })
              .where(eq(posts.id, c.subjectId));
          }
        }
      }
    }

    const kind =
      d.action === "warn"
        ? "add_warning_label"
        : d.action === "delete"
          ? "delete_content"
          : d.action === "hide"
            ? "hide_content"
            : "restore_content";
    await tx.insert(moderationActions).values({
      actorId: actor.id,
      kind,
      subjectType: d.subjectType,
      subjectId: d.subjectId,
      reason: d.note ?? `${kind.replace(/_/g, " ")} (proactive, no report)`,
    });
  });

  revalidatePath("/");
  revalidatePath("/admin/audit");
  if (d.path) revalidatePath(d.path);
  if (d.subjectType === "post") revalidatePath(`/posts/${d.subjectId}`);
  if (d.subjectType === "recipe") revalidatePath(`/recipes/${d.subjectId}`);
}

// ─── group & challenge moderation — hard delete, mods+ only (docs/07) ─────────
// Both are creator-owned containers with no soft-hide state, so moderation is a
// permanent delete. Cascades clean up children: a group takes its members,
// group-scoped challenges, and their participants; a challenge takes its
// participants. Group feed posts (posts.groupId, no FK) are left orphaned —
// same polymorphic-child convention as moderateContent's deletes.

const deleteGroupSchema = z.object({
  groupId: z.string().uuid(),
  note: z.string().max(300).optional(),
});

export async function deleteGroup(formData: FormData) {
  const actor = await assertModerator();
  const d = deleteGroupSchema.parse({
    groupId: formData.get("groupId"),
    note: formData.get("note") || undefined,
  });

  const [group] = await db.select().from(groups).where(eq(groups.id, d.groupId)).limit(1);
  if (!group) return;

  await db.transaction(async (tx) => {
    await tx.delete(groups).where(eq(groups.id, d.groupId));
    await tx.insert(moderationActions).values({
      actorId: actor.id,
      kind: "delete_group",
      subjectType: "group",
      subjectId: d.groupId,
      reason: d.note ?? `deleted group “${group.name}”`,
    });
  });

  revalidatePath("/groups");
  revalidatePath("/admin/audit");
  redirect("/groups");
}

const deleteChallengeSchema = z.object({
  challengeId: z.string().uuid(),
  note: z.string().max(300).optional(),
});

export async function deleteChallenge(formData: FormData) {
  const actor = await assertModerator();
  const d = deleteChallengeSchema.parse({
    challengeId: formData.get("challengeId"),
    note: formData.get("note") || undefined,
  });

  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, d.challengeId)).limit(1);
  if (!challenge) return;

  await db.transaction(async (tx) => {
    await tx.delete(challenges).where(eq(challenges.id, d.challengeId));
    await tx.insert(moderationActions).values({
      actorId: actor.id,
      kind: "delete_challenge",
      subjectType: "challenge",
      subjectId: d.challengeId,
      reason: d.note ?? `deleted challenge “${challenge.title}”`,
    });
  });

  revalidatePath("/challenges");
  revalidatePath("/admin/audit");
  if (challenge.groupId) redirect("/groups");
  redirect("/challenges");
}
