import { and, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  posts,
  profiles,
  users,
  follows,
  recipes,
  foodLogs,
  waterLogs,
  saves,
  votes,
  comments,
  reactions,
  progressEntries,
  habits,
  habitLogs,
  photos,
  mediaAttachments,
} from "@/db/schema";
import { shiftDate, todayStr } from "./utils";
import type { Remaining } from "./restaurants";

// ─── feed ────────────────────────────────────────────────────────────────────

export type FeedPost = {
  post: typeof posts.$inferSelect;
  author: { username: string; displayName: string; goal: string | null };
  recipe: typeof recipes.$inferSelect | null;
  myReaction: string | null;
};

export async function getFeed(viewerId: string, scope: "following" | "trending"): Promise<FeedPost[]> {
  const base = db
    .select({ post: posts, username: profiles.username, displayName: profiles.displayName, goal: profiles.goal })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId));

  // home feeds exclude group posts (those live on the group page) and moderated content
  const homeVisible = and(isNull(posts.groupId), eq(posts.isRemoved, false));

  let rows;
  if (scope === "following") {
    rows = await base
      .where(
        and(
          homeVisible,
          or(
            eq(posts.authorId, viewerId),
            inArray(posts.authorId, db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, viewerId))),
          ),
        ),
      )
      .orderBy(desc(posts.createdAt))
      .limit(40);
  } else {
    const cutoff = new Date(Date.now() - 14 * 86400_000);
    rows = await base
      .where(and(homeVisible, gte(posts.createdAt, cutoff)))
      .orderBy(desc(sql`${posts.reactionCount} * 3 + ${posts.commentCount} * 2`), desc(posts.createdAt))
      .limit(40);
  }

  // hydrate referenced recipes + viewer's reactions in two batch queries
  const recipeIds = rows.filter((r) => r.post.refType === "recipe" && r.post.refId).map((r) => r.post.refId!);
  const recipeRows = recipeIds.length ? await db.select().from(recipes).where(inArray(recipes.id, recipeIds)) : [];
  const recipeById = new Map(recipeRows.map((r) => [r.id, r]));

  const postIds = rows.map((r) => r.post.id);
  const myReactions = postIds.length
    ? await db
        .select()
        .from(reactions)
        .where(and(eq(reactions.userId, viewerId), eq(reactions.subjectType, "post"), inArray(reactions.subjectId, postIds)))
    : [];
  const myReactionByPost = new Map(myReactions.map((r) => [r.subjectId, r.kind]));

  return rows.map((r) => ({
    post: r.post,
    author: { username: r.username, displayName: r.displayName, goal: r.goal },
    recipe: r.post.refId ? (recipeById.get(r.post.refId) ?? null) : null,
    myReaction: myReactionByPost.get(r.post.id) ?? null,
  }));
}

export async function getUserPosts(viewerId: string, authorId: string): Promise<FeedPost[]> {
  const rows = await db
    .select({ post: posts, username: profiles.username, displayName: profiles.displayName, goal: profiles.goal })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(posts.authorId, authorId), isNull(posts.groupId), eq(posts.isRemoved, false)))
    .orderBy(desc(posts.createdAt))
    .limit(40);

  const recipeIds = rows.filter((r) => r.post.refType === "recipe" && r.post.refId).map((r) => r.post.refId!);
  const recipeRows = recipeIds.length ? await db.select().from(recipes).where(inArray(recipes.id, recipeIds)) : [];
  const recipeById = new Map(recipeRows.map((r) => [r.id, r]));

  const postIds = rows.map((r) => r.post.id);
  const myReactions = postIds.length
    ? await db
        .select()
        .from(reactions)
        .where(and(eq(reactions.userId, viewerId), eq(reactions.subjectType, "post"), inArray(reactions.subjectId, postIds)))
    : [];
  const myReactionByPost = new Map(myReactions.map((r) => [r.subjectId, r.kind]));

  return rows.map((r) => ({
    post: r.post,
    author: { username: r.username, displayName: r.displayName, goal: r.goal },
    recipe: r.post.refId ? (recipeById.get(r.post.refId) ?? null) : null,
    myReaction: myReactionByPost.get(r.post.id) ?? null,
  }));
}

export async function getGroupFeed(viewerId: string, groupId: string): Promise<FeedPost[]> {
  const rows = await db
    .select({ post: posts, username: profiles.username, displayName: profiles.displayName, goal: profiles.goal })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .where(and(eq(posts.groupId, groupId), eq(posts.isRemoved, false)))
    .orderBy(desc(posts.createdAt))
    .limit(40);

  const postIds = rows.map((r) => r.post.id);
  const myReactions = postIds.length
    ? await db
        .select()
        .from(reactions)
        .where(and(eq(reactions.userId, viewerId), eq(reactions.subjectType, "post"), inArray(reactions.subjectId, postIds)))
    : [];
  const myReactionByPost = new Map(myReactions.map((r) => [r.subjectId, r.kind]));

  return rows.map((r) => ({
    post: r.post,
    author: { username: r.username, displayName: r.displayName, goal: r.goal },
    recipe: null, // group posts are text posts in MVP (docs/05 §4: tag-filtered tabs come later)
    myReaction: myReactionByPost.get(r.post.id) ?? null,
  }));
}

// ─── recipes ─────────────────────────────────────────────────────────────────

export type RecipeSort = "hot" | "new" | "protein" | "top";

export async function listRecipes(opts: { q?: string; tag?: string; sort?: RecipeSort; authorId?: string; limit?: number }) {
  const conds = [eq(recipes.status, "published")];
  if (opts.q) conds.push(ilike(recipes.name, `%${opts.q}%`));
  if (opts.tag) conds.push(sql`${opts.tag} = ANY(${recipes.tags})`);
  if (opts.authorId) conds.push(eq(recipes.authorId, opts.authorId));

  const hotScore = sql`(${recipes.upvotes} - ${recipes.downvotes}) * 3 + ${recipes.saveCount} * 2 + ${recipes.logCount} * 4 + ${recipes.triedCount} * 3`;
  const order =
    opts.sort === "new"
      ? [desc(recipes.createdAt)]
      : opts.sort === "protein"
        ? [desc(sql`${recipes.proteinG} / GREATEST(${recipes.calories}, 1)`)]
        : opts.sort === "top"
          ? [desc(sql`${recipes.upvotes} - ${recipes.downvotes}`), desc(recipes.createdAt)]
          : [desc(hotScore), desc(recipes.createdAt)];

  return db
    .select({ recipe: recipes, username: profiles.username, displayName: profiles.displayName })
    .from(recipes)
    .innerJoin(profiles, eq(profiles.userId, recipes.authorId))
    .where(and(...conds))
    .orderBy(...order)
    .limit(opts.limit ?? 30);
}

export async function getSavedRecipes(userId: string) {
  return db
    .select({ recipe: recipes, username: profiles.username, displayName: profiles.displayName })
    .from(saves)
    .innerJoin(recipes, eq(recipes.id, saves.subjectId))
    .innerJoin(profiles, eq(profiles.userId, recipes.authorId))
    .where(and(eq(saves.userId, userId), eq(saves.subjectType, "recipe")))
    .orderBy(desc(saves.createdAt));
}

export async function getRecipeInteractions(viewerId: string, recipeId: string) {
  const [vote] = await db
    .select()
    .from(votes)
    .where(and(eq(votes.userId, viewerId), eq(votes.subjectType, "recipe"), eq(votes.subjectId, recipeId)));
  const [save] = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, viewerId), eq(saves.subjectType, "recipe"), eq(saves.subjectId, recipeId)));
  return { myVote: vote?.value ?? 0, saved: !!save };
}

// ─── tracker ─────────────────────────────────────────────────────────────────

export async function getDayLogs(userId: string, logDate: string) {
  const logs = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.logDate, logDate)))
    .orderBy(foodLogs.loggedAt);
  const [water] = await db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.logDate, logDate)));
  return { logs, waterMl: water?.ml ?? 0 };
}

export async function getWeekSummary(userId: string, endDate: string) {
  const startDate = shiftDate(endDate, -6);
  const rows = await db
    .select({
      logDate: foodLogs.logDate,
      calories: sql<number>`SUM(${foodLogs.calories})`,
      proteinG: sql<number>`SUM(${foodLogs.proteinG})`,
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.logDate, startDate)))
    .groupBy(foodLogs.logDate);
  return rows;
}

export async function getStreak(userId: string, fromDate: string): Promise<number> {
  const rows = await db
    .selectDistinct({ logDate: foodLogs.logDate })
    .from(foodLogs)
    .where(eq(foodLogs.userId, userId));
  return streakFromDates(new Set(rows.map((r) => r.logDate)), fromDate);
}

/** What's left of today's targets — the input to restaurant fit ranking (docs/06 §7b). */
export async function getRemainingMacros(
  userId: string,
  targets: { calories: number; proteinG: number } | null,
  logDate: string,
): Promise<Remaining | null> {
  if (!targets) return null;
  const [row] = await db
    .select({
      calories: sql<number>`COALESCE(SUM(${foodLogs.calories}), 0)`,
      proteinG: sql<number>`COALESCE(SUM(${foodLogs.proteinG}), 0)`,
      n: sql<number>`COUNT(*)`,
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.logDate, logDate)));
  return {
    calories: targets.calories - Number(row.calories),
    proteinG: targets.proteinG - Number(row.proteinG),
    logged: Number(row.n) > 0,
  };
}

/** Non-curated computed frequents (docs/08 §1b): GROUP BY over recent logs, no new table. */
export async function getFrequents(userId: string, limit = 6) {
  const cutoff = shiftDate(todayStr(), -30);
  return db
    .select({
      name: foodLogs.name,
      count: sql<number>`COUNT(*)`,
      calories: sql<number>`AVG(${foodLogs.calories})`,
      proteinG: sql<number>`AVG(${foodLogs.proteinG})`,
      carbsG: sql<number>`AVG(${foodLogs.carbsG})`,
      fatG: sql<number>`AVG(${foodLogs.fatG})`,
    })
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), gte(foodLogs.logDate, cutoff)))
    .groupBy(foodLogs.name)
    .having(sql`COUNT(*) >= 2`)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);
}

// ─── progress + habits ───────────────────────────────────────────────────────

export async function getProgressEntries(userId: string, limit = 120) {
  const rows = await db
    .select()
    .from(progressEntries)
    .where(eq(progressEntries.userId, userId))
    .orderBy(desc(progressEntries.entryDate))
    .limit(limit);
  return rows.reverse(); // oldest → newest for charting
}

/** Consecutive-day walk-back over a set of logged dates — shared by logging + habit streaks. */
export async function getProgressPhotos(userId: string, limit = 24) {
  return db
    .select({ photo: photos, entryDate: progressEntries.entryDate })
    .from(mediaAttachments)
    .innerJoin(photos, eq(photos.id, mediaAttachments.photoId))
    .innerJoin(progressEntries, eq(progressEntries.id, mediaAttachments.subjectId))
    .where(
      and(
        eq(photos.userId, userId),
        eq(photos.purpose, "progress"),
        eq(photos.isPrivate, true),
        eq(mediaAttachments.subjectType, "progress_entry"),
      ),
    )
    .orderBy(desc(progressEntries.entryDate), desc(photos.createdAt))
    .limit(limit);
}

export function streakFromDates(dates: Set<string>, fromDate: string): number {
  let streak = 0;
  let d = fromDate;
  if (!dates.has(d)) d = shiftDate(d, -1); // today not done yet doesn't break the streak
  while (dates.has(d)) {
    streak++;
    d = shiftDate(d, -1);
  }
  return streak;
}

export type HabitWithStreak = typeof habits.$inferSelect & { streak: number; doneToday: boolean };

export async function getHabitsWithStreaks(userId: string, today: string): Promise<HabitWithStreak[]> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.archived, false)))
    .orderBy(desc(habits.isDefault), habits.createdAt);
  if (!rows.length) return [];
  const logs = await db
    .select()
    .from(habitLogs)
    .where(inArray(habitLogs.habitId, rows.map((h) => h.id)));
  const datesByHabit = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!datesByHabit.has(l.habitId)) datesByHabit.set(l.habitId, new Set());
    datesByHabit.get(l.habitId)!.add(l.logDate);
  }
  return rows.map((h) => {
    const dates = datesByHabit.get(h.id) ?? new Set<string>();
    return { ...h, streak: streakFromDates(dates, today), doneToday: dates.has(today) };
  });
}

// ─── profiles ────────────────────────────────────────────────────────────────

export async function getProfileByUsername(username: string) {
  const [row] = await db
    .select({ profile: profiles, reputation: users.reputation })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(profiles.username, username.toLowerCase()))
    .limit(1);
  return row ?? null;
}

export async function getFollowStats(userId: string, viewerId: string) {
  const [followers] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(follows)
    .where(eq(follows.followeeId, userId));
  const [following] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(follows)
    .where(eq(follows.followerId, userId));
  const [me] = await db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), eq(follows.followeeId, userId)));
  return { followers: Number(followers.n), following: Number(following.n), isFollowing: !!me };
}

export async function getComments(subjectType: "post" | "recipe", subjectId: string) {
  return db
    .select({ comment: comments, username: profiles.username, displayName: profiles.displayName })
    .from(comments)
    .innerJoin(profiles, eq(profiles.userId, comments.authorId))
    .where(and(eq(comments.subjectType, subjectType), eq(comments.subjectId, subjectId)))
    .orderBy(comments.createdAt);
}

export async function getSuggestedUsers(viewerId: string, limit = 5) {
  return db
    .select({ profile: profiles, reputation: users.reputation })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(
      and(
        sql`${profiles.userId} <> ${viewerId}`,
        sql`${profiles.userId} NOT IN (SELECT followee_id FROM follows WHERE follower_id = ${viewerId})`,
      ),
    )
    .orderBy(desc(users.reputation))
    .limit(limit);
}
