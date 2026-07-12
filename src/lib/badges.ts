import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  badges,
  challengeParticipants,
  comments,
  follows,
  foodLogs,
  habitLogs,
  habits,
  personalRecords,
  posts,
  profiles,
  userBadges,
  users,
  workoutLogs,
} from "@/db/schema";
import { isMissingTableError } from "@/lib/dbErrors";
import { createNotifications } from "@/lib/notify";

export const BADGE_METRICS = {
  reputation: "Reputation points",
  posts: "Posts created",
  comments: "Comments created",
  followers: "Followers",
  logged_days: "Distinct nutrition logging days",
  workouts: "Workouts completed",
  personal_records: "Personal records",
  habit_checkins: "Habit check-ins",
  challenge_completions: "Challenges completed",
} as const;

export type BadgeMetric = keyof typeof BADGE_METRICS;
export type DisplayBadge = Pick<typeof badges.$inferSelect, "id" | "name" | "description" | "icon">;

async function metricValue(userId: string, metric: BadgeMetric): Promise<number> {
  if (metric === "reputation") {
    const [row] = await db.select({ n: users.reputation }).from(users).where(eq(users.id, userId)).limit(1);
    return Number(row?.n ?? 0);
  }
  if (metric === "posts") {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(posts).where(eq(posts.authorId, userId));
    return Number(row.n);
  }
  if (metric === "comments") {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(comments).where(eq(comments.authorId, userId));
    return Number(row.n);
  }
  if (metric === "followers") {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(follows).where(eq(follows.followeeId, userId));
    return Number(row.n);
  }
  if (metric === "logged_days") {
    const [row] = await db.select({ n: sql<number>`count(distinct ${foodLogs.logDate})` }).from(foodLogs).where(eq(foodLogs.userId, userId));
    return Number(row.n);
  }
  if (metric === "workouts") {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(workoutLogs).where(eq(workoutLogs.userId, userId));
    return Number(row.n);
  }
  if (metric === "personal_records") {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(personalRecords).where(eq(personalRecords.userId, userId));
    return Number(row.n);
  }
  if (metric === "habit_checkins") {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(habitLogs)
      .innerJoin(habits, eq(habits.id, habitLogs.habitId))
      .where(eq(habits.userId, userId));
    return Number(row.n);
  }
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.userId, userId), isNotNull(challengeParticipants.completedAt)));
  return Number(row.n);
}

/** Awards every newly satisfied automatic badge. Awards are permanent snapshots. */
export async function syncAutomaticBadgesForUser(userId: string) {
  try {
    const definitions = await db
      .select()
      .from(badges)
      .where(and(eq(badges.isActive, true), eq(badges.awardMode, "automatic"), isNotNull(badges.metric), isNotNull(badges.threshold)));
    if (!definitions.length) return;

    const metrics = [...new Set(definitions.map((definition) => definition.metric as BadgeMetric).filter((metric) => metric in BADGE_METRICS))];
    const values = new Map(await Promise.all(metrics.map(async (metric) => [metric, await metricValue(userId, metric)] as const)));
    const eligible = [];
    for (const definition of definitions) {
      const metric = definition.metric as BadgeMetric;
      if (!(metric in BADGE_METRICS)) continue;
      if ((values.get(metric) ?? 0) >= Number(definition.threshold)) eligible.push(definition);
    }
    if (!eligible.length) return;

    const inserted = await db
      .insert(userBadges)
      .values(eligible.map((badge) => ({ userId, badgeId: badge.id, awardSource: "automatic" })))
      .onConflictDoNothing()
      .returning({ badgeId: userBadges.badgeId });
    if (!inserted.length) return;
    const insertedIds = new Set(inserted.map((row) => row.badgeId));
    const [profile] = await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
    await createNotifications(
      eligible
        .filter((badge) => insertedIds.has(badge.id))
        .map((badge) => ({
          userId,
          actorId: null,
          kind: "badge_awarded",
          subjectType: "badge",
          subjectId: badge.id,
          message: `You earned the ${badge.name} badge`,
          href: profile ? `/u/${profile.username}` : "/",
        })),
    ).catch(() => {});
  } catch (error) {
    if (isMissingTableError(error, "badges") || isMissingTableError(error, "user_badges")) return;
    throw error;
  }
}

export async function getBadgesForUsers(userIds: string[]) {
  const ids = [...new Set(userIds)];
  const result = new Map<string, DisplayBadge[]>();
  if (!ids.length) return result;
  try {
    const rows = await db
      .select({ userId: userBadges.userId, badge: badges })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(and(inArray(userBadges.userId, ids), eq(badges.isActive, true)))
      .orderBy(userBadges.awardedAt);
    for (const row of rows) {
      const list = result.get(row.userId) ?? [];
      list.push({ id: row.badge.id, name: row.badge.name, description: row.badge.description, icon: row.badge.icon });
      result.set(row.userId, list);
    }
    return result;
  } catch (error) {
    if (isMissingTableError(error, "badges") || isMissingTableError(error, "user_badges")) return result;
    throw error;
  }
}

export async function getUserBadges(userId: string) {
  return (await getBadgesForUsers([userId])).get(userId) ?? [];
}
