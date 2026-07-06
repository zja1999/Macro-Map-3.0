"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { challengeParticipants, challenges, groupMembers, groups, moderationActions, posts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getGroupAuthority } from "@/lib/groups";
import { CHALLENGE_METRICS } from "@/lib/challenges";
import { todayStr } from "@/lib/utils";

const GROUP_KINDS = ["goal", "diet", "location", "gym", "interest"] as const;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

const createGroupSchema = z.object({
  name: z.string().min(3).max(60),
  description: z.string().max(300).optional(),
  kind: z.enum(GROUP_KINDS),
});

export async function createGroup(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = createGroupSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: "Group needs a name (3+ characters)." };

  const slug = slugify(parsed.data.name);
  if (!slug) return { error: "Pick a name with some letters in it." };
  const [taken] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, slug)).limit(1);
  if (taken) return { error: "A group with that name already exists." };

  const groupId = await db.transaction(async (tx) => {
    const [group] = await tx
      .insert(groups)
      .values({ ...parsed.data, slug, memberCount: 1, createdBy: user.id })
      .returning({ id: groups.id });
    await tx.insert(groupMembers).values({ groupId: group.id, userId: user.id, role: "owner" });
    return group.id;
  });
  void groupId;
  redirect(`/groups/${slug}`);
}

export async function toggleGroupMembership(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const groupId = z.string().uuid().parse(formData.get("groupId"));
  const slug = z.string().max(60).parse(formData.get("slug"));

  const where = and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id));
  const [existing] = await db.select().from(groupMembers).where(where);
  if (existing?.role === "owner") return; // owners transfer, not vanish — later phase

  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(groupMembers).where(where);
      await tx.update(groups).set({ memberCount: sql`${groups.memberCount} - 1` }).where(eq(groups.id, groupId));
    } else {
      await tx.insert(groupMembers).values({ groupId, userId: user.id });
      await tx.update(groups).set({ memberCount: sql`${groups.memberCount} + 1` }).where(eq(groups.id, groupId));
    }
  });
  revalidatePath(`/groups/${slug}`);
  revalidatePath("/groups");
}

/** Hand a group off to another member. Allowed for the current owner (self-service)
 * or any platform moderator/admin. Keeps groups.createdBy in sync with the owner so
 * the group's lifecycle follows the current owner, not the original creator (this is
 * also what stops a later account deletion from taking a group that's been handed off).
 * Moderator-initiated transfers are audit-logged. */
const transferSchema = z.object({
  groupId: z.string().uuid(),
  newOwnerId: z.string().uuid(),
});

export async function transferGroupOwnership(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = transferSchema.parse({
    groupId: formData.get("groupId"),
    newOwnerId: formData.get("newOwnerId"),
  });

  const [group] = await db.select().from(groups).where(eq(groups.id, d.groupId)).limit(1);
  if (!group) throw new Error("Group not found");

  const [myMembership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, user.id)));
  const isOwner = myMembership?.role === "owner";
  const byModerator = isModerator(user) && !isOwner;
  if (!isOwner && !byModerator) throw new Error("Only the group owner or a moderator can transfer ownership");

  // the new owner must already be a member
  const [target] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, d.newOwnerId)));
  if (!target) throw new Error("The new owner must be a member of the group");
  if (target.role === "owner") return; // already the owner — nothing to do

  // the sitting owner (may differ from the actor when a moderator acts)
  const [currentOwner] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.role, "owner")));

  await db.transaction(async (tx) => {
    if (currentOwner) {
      await tx
        .update(groupMembers)
        .set({ role: "member" })
        .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, currentOwner.userId)));
    }
    await tx
      .update(groupMembers)
      .set({ role: "owner" })
      .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, d.newOwnerId)));
    await tx.update(groups).set({ createdBy: d.newOwnerId }).where(eq(groups.id, d.groupId));

    if (byModerator) {
      await tx.insert(moderationActions).values({
        actorId: user.id,
        kind: "transfer_group_owner",
        subjectType: "group",
        subjectId: d.groupId,
        reason: `transferred ownership of “${group.name}”`,
      });
    }
  });

  revalidatePath(`/groups/${group.slug}`);
  if (byModerator) revalidatePath("/admin/audit");
}

// ─── in-group moderation — owner + group moderators (docs/05 §4) ──────────────
// Group owners and the moderators they appoint police their own group: they can
// remove/restore/delete posts and remove or promote members. Platform mods can do
// all of this too. These powers are scoped to the group — they never touch content
// outside it, and they don't write to the platform audit log.

const groupPostModSchema = z.object({
  postId: z.string().uuid(),
  groupId: z.string().uuid(),
  slug: z.string().max(60),
  action: z.enum(["hide", "restore", "delete"]),
});

export async function moderateGroupPost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = groupPostModSchema.parse({
    postId: formData.get("postId"),
    groupId: formData.get("groupId"),
    slug: formData.get("slug"),
    action: formData.get("action"),
  });

  const { canManage } = await getGroupAuthority(user, d.groupId);
  if (!canManage) throw new Error("You don't moderate this group");

  // the post must actually belong to this group — no reaching outside it
  const [post] = await db.select().from(posts).where(eq(posts.id, d.postId)).limit(1);
  if (!post || post.groupId !== d.groupId) throw new Error("Post not found in this group");

  if (d.action === "delete") {
    await db.delete(posts).where(eq(posts.id, d.postId));
  } else {
    await db.update(posts).set({ isRemoved: d.action === "hide" }).where(eq(posts.id, d.postId));
  }
  revalidatePath(`/groups/${d.slug}`);
}

const memberActionSchema = z.object({
  groupId: z.string().uuid(),
  userId: z.string().uuid(),
  slug: z.string().max(60),
});

/** Remove a member from a group. Owner-level actors can remove any non-owner;
 * a group moderator can only remove plain members. The owner is never kickable
 * (hand off or delete the group instead), and you can't remove yourself here. */
export async function removeGroupMember(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = memberActionSchema.parse({
    groupId: formData.get("groupId"),
    userId: formData.get("userId"),
    slug: formData.get("slug"),
  });
  if (d.userId === user.id) throw new Error("Use “Leave” to remove yourself");

  const { canManage, ownerLevel } = await getGroupAuthority(user, d.groupId);
  if (!canManage) throw new Error("You don't moderate this group");

  const [target] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, d.userId)));
  if (!target) return;
  if (target.role === "owner") throw new Error("The owner can't be removed — transfer ownership first");
  if (target.role === "moderator" && !ownerLevel) throw new Error("Only the owner can remove a moderator");

  await db.transaction(async (tx) => {
    await tx.delete(groupMembers).where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, d.userId)));
    await tx.update(groups).set({ memberCount: sql`GREATEST(0, ${groups.memberCount} - 1)` }).where(eq(groups.id, d.groupId));
  });
  revalidatePath(`/groups/${d.slug}`);
}

const setRoleSchema = memberActionSchema.extend({
  role: z.enum(["member", "moderator"]),
});

/** Promote a member to group moderator, or demote back. Owner-level only.
 * The owner role is managed through transfer, not here. */
export async function setGroupMemberRole(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = setRoleSchema.parse({
    groupId: formData.get("groupId"),
    userId: formData.get("userId"),
    slug: formData.get("slug"),
    role: formData.get("role"),
  });

  const { ownerLevel } = await getGroupAuthority(user, d.groupId);
  if (!ownerLevel) throw new Error("Only the owner can change member roles");

  const [target] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, d.userId)));
  if (!target) return;
  if (target.role === "owner") throw new Error("Transfer ownership instead of changing the owner's role");

  await db
    .update(groupMembers)
    .set({ role: d.role })
    .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, d.userId)));
  revalidatePath(`/groups/${d.slug}`);
}

// ─── challenges ──────────────────────────────────────────────────────────────

const METRIC_KEYS = CHALLENGE_METRICS.map((m) => m.key);

const createChallengeSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(300).optional(),
  metric: z.string().refine((m) => METRIC_KEYS.includes(m as (typeof METRIC_KEYS)[number])),
  target: z.coerce.number().min(1).max(1000),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupId: z.string().uuid().optional(),
});

export async function createChallenge(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = createChallengeSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    metric: formData.get("metric"),
    target: formData.get("target"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    groupId: formData.get("groupId") || undefined,
  });
  if (!parsed.success) return { error: "Fill in title, metric, target, and dates." };
  const d = parsed.data;
  if (d.endsOn <= d.startsOn) return { error: "End date must be after the start date." };

  if (d.groupId) {
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, d.groupId), eq(groupMembers.userId, user.id)));
    if (!member) return { error: "Join the group before creating a challenge in it." };
  }

  const metricInfo = CHALLENGE_METRICS.find((m) => m.key === d.metric)!;
  const [challenge] = await db
    .insert(challenges)
    .values({ ...d, unit: metricInfo.unit, createdBy: user.id, groupId: d.groupId ?? null })
    .returning({ id: challenges.id });
  // creator joins their own challenge — an empty leaderboard helps nobody
  await db.insert(challengeParticipants).values({ challengeId: challenge.id, userId: user.id });
  redirect(`/challenges/${challenge.id}`);
}

export async function joinChallenge(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const challengeId = z.string().uuid().parse(formData.get("challengeId"));
  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!challenge) throw new Error("Challenge not found");
  await db.insert(challengeParticipants).values({ challengeId, userId: user.id }).onConflictDoNothing();
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
}

export async function leaveChallenge(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const challengeId = z.string().uuid().parse(formData.get("challengeId"));
  await db
    .delete(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, user.id)));
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
}

/** custom_checkin metric: one self-reported check-in per day. */
export async function checkinChallenge(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const challengeId = z.string().uuid().parse(formData.get("challengeId"));

  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!challenge || challenge.metric !== "custom_checkin") throw new Error("Not a check-in challenge");
  const today = todayStr();
  if (challenge.endsOn < today || challenge.startsOn > today) return; // outside window

  const where = and(
    eq(challengeParticipants.challengeId, challengeId),
    eq(challengeParticipants.userId, user.id),
  );
  const [participant] = await db.select().from(challengeParticipants).where(where);
  if (!participant || participant.lastCheckinOn === today) return;

  const progress = participant.progress + 1;
  await db
    .update(challengeParticipants)
    .set({
      progress,
      lastCheckinOn: today,
      completedAt: progress >= challenge.target && !participant.completedAt ? new Date() : participant.completedAt,
    })
    .where(where);
  revalidatePath(`/challenges/${challengeId}`);
}
