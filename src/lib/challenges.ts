/* Challenge auto-scoring computes from existing logs on view; a nightly job would
 * only be an optimization. See docs/domains/community-and-trust.md. */
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  challengeParticipants,
  challenges,
  foodLogs,
  groups,
  nutritionTargets,
  profiles,
  workoutLogs,
} from "@/db/schema";
import { todayStr } from "./utils";

export type Challenge = typeof challenges.$inferSelect;

export const CHALLENGE_METRICS = [
  { key: "logged_days", label: "Days with food logged", unit: "days", auto: true },
  { key: "protein_days", label: "Days protein goal hit", unit: "days", auto: true },
  { key: "workouts", label: "Workouts completed", unit: "sessions", auto: true },
  { key: "custom_checkin", label: "Daily check-in (self-reported)", unit: "check-ins", auto: false },
] as const;

/** Progress for one auto-scored participant inside the challenge window (capped at today). */
async function computeAutoProgress(challenge: Challenge, userId: string): Promise<number> {
  const windowEnd = challenge.endsOn < todayStr() ? challenge.endsOn : todayStr();

  if (challenge.metric === "logged_days") {
    const [row] = await db
      .select({ n: sql<number>`COUNT(DISTINCT ${foodLogs.logDate})` })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), gte(foodLogs.logDate, challenge.startsOn), lte(foodLogs.logDate, windowEnd)));
    return Number(row.n);
  }

  if (challenge.metric === "protein_days") {
    const [target] = await db
      .select({ proteinG: nutritionTargets.proteinG })
      .from(nutritionTargets)
      .where(eq(nutritionTargets.userId, userId))
      .orderBy(desc(nutritionTargets.createdAt))
      .limit(1);
    if (!target) return 0;
    const rows = await db
      .select({ logDate: foodLogs.logDate, protein: sql<number>`SUM(${foodLogs.proteinG})` })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), gte(foodLogs.logDate, challenge.startsOn), lte(foodLogs.logDate, windowEnd)))
      .groupBy(foodLogs.logDate);
    // 95% tolerance: hitting protein within a scoop counts (consistency framing, not perfection)
    return rows.filter((r) => Number(r.protein) >= target.proteinG * 0.95).length;
  }

  if (challenge.metric === "workouts") {
    const [row] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(workoutLogs)
      .where(
        and(
          eq(workoutLogs.userId, userId),
          gte(workoutLogs.performedAt, new Date(`${challenge.startsOn}T00:00:00`)),
          lte(workoutLogs.performedAt, new Date(`${windowEnd}T23:59:59`)),
        ),
      );
    return Number(row.n);
  }

  return 0; // custom_checkin: manual, stored progress is the truth
}

export type LeaderboardRow = {
  userId: string;
  username: string;
  displayName: string;
  progress: number;
  completedAt: Date | null;
};

/** Recomputes auto-scored progress for every participant, persists it, returns the board. */
export async function getLeaderboard(challenge: Challenge): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({ p: challengeParticipants, username: profiles.username, displayName: profiles.displayName })
    .from(challengeParticipants)
    .innerJoin(profiles, eq(profiles.userId, challengeParticipants.userId))
    .where(eq(challengeParticipants.challengeId, challenge.id));

  const isAuto = challenge.metric !== "custom_checkin";
  const board: LeaderboardRow[] = [];
  for (const row of rows) {
    let progress = row.p.progress;
    let completedAt = row.p.completedAt;
    if (isAuto) {
      progress = await computeAutoProgress(challenge, row.p.userId);
      if (progress >= challenge.target && !completedAt) completedAt = new Date();
      if (progress !== row.p.progress || completedAt !== row.p.completedAt) {
        await db
          .update(challengeParticipants)
          .set({ progress, completedAt })
          .where(
            and(
              eq(challengeParticipants.challengeId, challenge.id),
              eq(challengeParticipants.userId, row.p.userId),
            ),
          );
      }
    }
    board.push({ userId: row.p.userId, username: row.username, displayName: row.displayName, progress, completedAt });
  }
  return board.sort((a, b) => b.progress - a.progress);
}

export async function listChallenges(viewerId: string) {
  const rows = await db
    .select({ challenge: challenges, groupName: groups.name, groupSlug: groups.slug })
    .from(challenges)
    .leftJoin(groups, eq(groups.id, challenges.groupId))
    .orderBy(desc(challenges.endsOn))
    .limit(40);
  const ids = rows.map((r) => r.challenge.id);
  const mine = ids.length
    ? await db
        .select()
        .from(challengeParticipants)
        .where(and(eq(challengeParticipants.userId, viewerId), inArray(challengeParticipants.challengeId, ids)))
    : [];
  const mineById = new Map(mine.map((m) => [m.challengeId, m]));
  const counts = ids.length
    ? await db
        .select({ challengeId: challengeParticipants.challengeId, n: sql<number>`COUNT(*)` })
        .from(challengeParticipants)
        .where(inArray(challengeParticipants.challengeId, ids))
        .groupBy(challengeParticipants.challengeId)
    : [];
  const countById = new Map(counts.map((c) => [c.challengeId, Number(c.n)]));
  return rows.map((r) => ({
    ...r,
    joined: mineById.get(r.challenge.id) ?? null,
    participantCount: countById.get(r.challenge.id) ?? 0,
    active: r.challenge.endsOn >= todayStr(),
  }));
}
