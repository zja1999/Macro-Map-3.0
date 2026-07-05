"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { follows, groupMembers, posts, comments, reactions, recipes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { REACTION_KINDS } from "@/lib/utils";

export async function toggleFollow(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const followeeId = z.string().uuid().parse(formData.get("userId"));
  const username = String(formData.get("username") ?? "");
  if (followeeId === user.id) return;

  const where = and(eq(follows.followerId, user.id), eq(follows.followeeId, followeeId));
  const [existing] = await db.select().from(follows).where(where);
  if (existing) await db.delete(follows).where(where);
  else await db.insert(follows).values({ followerId: user.id, followeeId });
  revalidatePath(`/u/${username}`);
  revalidatePath("/");
}

const postSchema = z.object({
  body: z.string().min(1).max(2000),
  type: z.enum(["general", "tip", "question", "progress", "personal_record"]).default("general"),
  groupId: z.string().uuid().optional(), // group feed post (docs/05 §4)
  groupSlug: z.string().max(60).optional(),
});

export async function createPost(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = postSchema.safeParse({
    body: formData.get("body"),
    type: formData.get("type") || "general",
    groupId: formData.get("groupId") || undefined,
    groupSlug: formData.get("groupSlug") || undefined,
  });
  if (!parsed.success) return { error: "Write something first" };

  const rateError = await checkRateLimit(user.id, "post", user.reputation);
  if (rateError) return { error: rateError };

  if (parsed.data.groupId) {
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, parsed.data.groupId), eq(groupMembers.userId, user.id)));
    if (!member) return { error: "Join the group to post in it." };
  }

  await db.insert(posts).values({
    authorId: user.id,
    type: parsed.data.type,
    body: parsed.data.body,
    groupId: parsed.data.groupId ?? null,
  });
  revalidatePath(parsed.data.groupSlug ? `/groups/${parsed.data.groupSlug}` : "/");
  return {};
}

export async function shareRecipeToFeed(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const recipeId = z.string().uuid().parse(formData.get("recipeId"));
  const body = z.string().max(500).parse(formData.get("body") ?? "");

  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
  if (!recipe) throw new Error("Recipe not found");

  await db.insert(posts).values({
    authorId: user.id,
    type: "recipe",
    body: body || null,
    refType: "recipe",
    refId: recipeId,
  });
  redirect("/");
}

export async function deletePost(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = z.string().uuid().parse(formData.get("postId"));
  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.authorId, user.id)));
  revalidatePath("/");
  redirect("/");
}

const VALID_KINDS = REACTION_KINDS.map((r) => r.kind as string);

export async function toggleReaction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const postId = z.string().uuid().parse(formData.get("postId"));
  const kind = z.string().refine((k) => VALID_KINDS.includes(k)).parse(formData.get("kind"));

  const where = and(
    eq(reactions.userId, user.id),
    eq(reactions.subjectType, "post"),
    eq(reactions.subjectId, postId),
  );
  const [existing] = await db.select().from(reactions).where(where);

  await db.transaction(async (tx) => {
    if (existing && existing.kind === kind) {
      await tx.delete(reactions).where(where);
      await tx.update(posts).set({ reactionCount: sql`${posts.reactionCount} - 1` }).where(eq(posts.id, postId));
    } else if (existing) {
      await tx.update(reactions).set({ kind }).where(where);
    } else {
      await tx.insert(reactions).values({ userId: user.id, subjectType: "post", subjectId: postId, kind });
      await tx.update(posts).set({ reactionCount: sql`${posts.reactionCount} + 1` }).where(eq(posts.id, postId));
    }
  });
  revalidatePath("/");
  revalidatePath(`/posts/${postId}`);
}

const commentSchema = z.object({
  subjectType: z.enum(["post", "recipe"]),
  subjectId: z.string().uuid(),
  body: z.string().min(1).max(1000),
});

export async function addComment(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = commentSchema.parse(Object.fromEntries(formData));

  const rateError = await checkRateLimit(user.id, "comment", user.reputation);
  if (rateError) throw new Error(rateError);

  await db.transaction(async (tx) => {
    await tx.insert(comments).values({ authorId: user.id, ...d });
    if (d.subjectType === "post") {
      await tx.update(posts).set({ commentCount: sql`${posts.commentCount} + 1` }).where(eq(posts.id, d.subjectId));
    }
  });
  revalidatePath(d.subjectType === "post" ? `/posts/${d.subjectId}` : `/recipes/${d.subjectId}`);
}
