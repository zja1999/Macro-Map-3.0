/* Workout domain logic: estimated-1RM / volume math, PR detection against
 * personal_records, and the workout list/detail queries. */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  exercises,
  personalRecords,
  profiles,
  saves,
  workoutLogs,
  workouts,
  type WorkoutLogEntries,
} from "@/db/schema";
import { formatWeight, type UnitsPref } from "@/lib/units";

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;

// ─── PR math ─────────────────────────────────────────────────────────────────

/** Epley estimated 1RM. Reps beyond 12 barely move e1RM and get noisy — capped. */
export function epley1rm(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  return weightKg * (1 + Math.min(reps, 12) / 30);
}

export type SetEntry = { reps: number; weightKg: number | null };

export function bestE1rm(sets: SetEntry[]): number {
  return Math.max(0, ...sets.map((s) => epley1rm(s.weightKg ?? 0, s.reps)));
}

export function totalVolume(sets: SetEntry[]): number {
  return sets.reduce((a, s) => a + (s.weightKg ?? 0) * s.reps, 0);
}

/** Bodyweight movements have no meaningful e1RM without added load — best-set reps instead. */
export function bestReps(sets: SetEntry[]): number {
  return Math.max(0, ...sets.map((s) => s.reps));
}

export type PrHit = { exerciseId: string; exerciseName: string; metric: string; value: number; previous: number | null };

/** Compares a finished session against stored PRs; returns the beats (caller persists them). */
export async function detectPrs(userId: string, entries: WorkoutLogEntries): Promise<PrHit[]> {
  const exerciseIds = entries.map((e) => e.exerciseId);
  if (!exerciseIds.length) return [];
  const [exRows, prRows] = await Promise.all([
    db.select().from(exercises).where(inArray(exercises.id, exerciseIds)),
    db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.userId, userId), inArray(personalRecords.exerciseId, exerciseIds))),
  ]);
  const exById = new Map(exRows.map((e) => [e.id, e]));
  const prByKey = new Map(prRows.map((p) => [`${p.exerciseId}|${p.metric}`, p]));

  const hits: PrHit[] = [];
  for (const entry of entries) {
    const ex = exById.get(entry.exerciseId);
    if (!ex || !entry.sets.length) continue;
    const candidates: [metric: string, value: number][] = ex.isBodyweight
      ? [
          ["reps", bestReps(entry.sets)],
          ["volume", totalVolume(entry.sets)],
        ]
      : [
          ["e1rm", Math.round(bestE1rm(entry.sets) * 10) / 10],
          ["volume", totalVolume(entry.sets)],
        ];
    for (const [metric, value] of candidates) {
      if (value <= 0) continue;
      const prev = prByKey.get(`${entry.exerciseId}|${metric}`);
      if (!prev || value > prev.value) {
        hits.push({ exerciseId: ex.id, exerciseName: ex.name, metric, value, previous: prev?.value ?? null });
      }
    }
  }
  return hits;
}

export function prLabel(hit: { metric: string; value: number }, units: UnitsPref): string {
  if (hit.metric === "e1rm") return `${formatWeight(hit.value, units)} est. 1RM`;
  if (hit.metric === "volume") return `${formatWeight(hit.value, units, 0)} total volume`;
  return `${hit.value} reps`;
}

// ─── queries ─────────────────────────────────────────────────────────────────

export type WorkoutListRow = { workout: Workout; username: string | null; displayName: string | null };

export async function listWorkouts(opts: {
  scope: "community" | "templates";
  limit?: number;
}): Promise<WorkoutListRow[]> {
  const rows = await db
    .select({ workout: workouts, username: profiles.username, displayName: profiles.displayName })
    .from(workouts)
    .leftJoin(profiles, eq(profiles.userId, workouts.authorId))
    .where(and(eq(workouts.status, "published"), eq(workouts.isTemplate, opts.scope === "templates")))
    .orderBy(
      opts.scope === "templates" ? workouts.title : desc(workouts.completedCount),
      desc(workouts.createdAt),
    )
    .limit(opts.limit ?? 30);
  return rows;
}

export async function getSavedWorkouts(userId: string): Promise<WorkoutListRow[]> {
  return db
    .select({ workout: workouts, username: profiles.username, displayName: profiles.displayName })
    .from(saves)
    .innerJoin(workouts, eq(workouts.id, saves.subjectId))
    .leftJoin(profiles, eq(profiles.userId, workouts.authorId))
    .where(and(eq(saves.userId, userId), eq(saves.subjectType, "workout")))
    .orderBy(desc(saves.createdAt));
}

export async function getWorkoutWithExercises(workoutId: string) {
  const [row] = await db
    .select({ workout: workouts, username: profiles.username, displayName: profiles.displayName })
    .from(workouts)
    .leftJoin(profiles, eq(profiles.userId, workouts.authorId))
    .where(eq(workouts.id, workoutId))
    .limit(1);
  if (!row) return null;
  const ids = row.workout.structure.map((s) => s.exerciseId);
  const exRows = ids.length ? await db.select().from(exercises).where(inArray(exercises.id, ids)) : [];
  return { ...row, exerciseById: new Map(exRows.map((e) => [e.id, e])) };
}

export async function getRecentWorkoutLogs(userId: string, limit = 10) {
  const logs = await db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.userId, userId))
    .orderBy(desc(workoutLogs.performedAt))
    .limit(limit);
  const exerciseIds = [...new Set(logs.flatMap((l) => l.entries.map((e) => e.exerciseId)))];
  const exRows = exerciseIds.length ? await db.select().from(exercises).where(inArray(exercises.id, exerciseIds)) : [];
  return { logs, exerciseById: new Map(exRows.map((e) => [e.id, e])) };
}

export async function getMyPrs(userId: string) {
  return db
    .select({ pr: personalRecords, exerciseName: exercises.name })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(eq(personalRecords.userId, userId))
    .orderBy(desc(personalRecords.achievedAt));
}
