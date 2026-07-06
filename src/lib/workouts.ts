/* Workout domain logic: typed session summaries, distance/pace formatting,
 * strength/cardio PR detection, and workout list/detail queries. */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  exercises,
  personalRecords,
  profiles,
  saves,
  workoutLogs,
  workouts,
  type ActivityType,
  type CardioLogEntry,
  type LegacyWorkoutLogEntry,
  type MobilityLogEntry,
  type StrengthLogEntry,
  type WorkoutLogEntries,
  type WorkoutStructure,
} from "@/db/schema";
import { formatWeight, type UnitsPref } from "@/lib/units";

export type Exercise = typeof exercises.$inferSelect;
export type Workout = typeof workouts.$inferSelect;

const MI_PER_M = 0.000621371;
const KM_PER_M = 0.001;

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  strength: "Strength",
  outdoor_run: "Outdoor Run",
  treadmill_run: "Treadmill Run",
  rowing: "Rowing Machine",
  stationary_bike: "Stationary Bike",
  outdoor_bike: "Outdoor Bike",
  walk: "Walk",
  hike: "Hike",
  elliptical: "Elliptical",
  mobility: "Mobility",
  generic_cardio: "Cardio",
};

export function activityKind(activityType: ActivityType): "strength" | "cardio" | "mobility" {
  if (activityType === "strength") return "strength";
  if (activityType === "mobility") return "mobility";
  return "cardio";
}

// ─── formatting ─────────────────────────────────────────────────────────────

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "-";
  const totalSeconds = Math.round(minutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDistance(meters: number | null | undefined, units: UnitsPref, activityType?: ActivityType): string {
  if (meters == null || !Number.isFinite(meters)) return "-";
  if (activityType === "rowing") return `${Math.round(meters).toLocaleString()} m`;
  if (units === "imperial") return `${(meters * MI_PER_M).toFixed(meters >= 1609 ? 2 : 1)} mi`;
  return `${(meters * KM_PER_M).toFixed(meters >= 1000 ? 2 : 1)} km`;
}

export function formatSpeed(kph: number | null | undefined, units: UnitsPref): string {
  if (kph == null || !Number.isFinite(kph)) return "-";
  return units === "imperial" ? `${(kph * 0.621371).toFixed(1)} mph` : `${kph.toFixed(1)} km/h`;
}

export function formatPace(durationMin: number, distanceM: number, units: UnitsPref, activityType?: ActivityType): string {
  if (!durationMin || !distanceM) return "-";
  if (activityType === "rowing") return `${formatDuration(durationMin / (distanceM / 500))}/500m`;
  const unitDistance = units === "imperial" ? distanceM * MI_PER_M : distanceM * KM_PER_M;
  if (unitDistance <= 0) return "-";
  return `${formatDuration(durationMin / unitDistance)}/${units === "imperial" ? "mi" : "km"}`;
}

function isLegacyEntry(entry: WorkoutLogEntries[number]): entry is LegacyWorkoutLogEntry {
  return !("kind" in entry) && "sets" in entry;
}

function isLegacyCardio(entry: LegacyWorkoutLogEntry): boolean {
  return entry.sets.length > 0 && entry.sets.every((s) => (s.durationMin ?? 0) > 0 && s.reps === 0);
}

export function structureSummary(structure: WorkoutStructure, exerciseById: Map<string, Exercise>, units: UnitsPref): string {
  if (!structure.length) return "No planned movements";
  return structure
    .slice(0, 3)
    .map((s) => {
      const ex = exerciseById.get(s.exerciseId);
      const label = ex?.name ?? ACTIVITY_LABELS[s.activityType ?? "strength"];
      const activityType = (s.activityType ?? ex?.activityType ?? "strength") as ActivityType;
      if (activityType === "strength") return `${label} ${s.sets ?? 1} x ${s.reps ?? "reps"}`;
      const bits = [label];
      if (s.targetDistanceM) bits.push(formatDistance(s.targetDistanceM, units, activityType));
      if (s.targetDurationMin) bits.push(formatDuration(s.targetDurationMin));
      return bits.join(" · ");
    })
    .join(" · ");
}

export function workoutLogSummary(
  entries: WorkoutLogEntries,
  exerciseById: Map<string, Exercise>,
  units: UnitsPref,
): string {
  if (!entries.length) return "Empty session";
  return entries
    .map((entry) => {
      if (isLegacyEntry(entry)) {
        const ex = exerciseById.get(entry.exerciseId);
        if (isLegacyCardio(entry)) {
          const duration = entry.sets.reduce((a, s) => a + (s.durationMin ?? 0), 0);
          return `${ex?.name ?? "Cardio"} · ${formatDuration(duration)}`;
        }
        const top = entry.sets
          .filter((s) => s.reps > 0)
          .sort((a, b) => (b.weightKg ?? 0) * b.reps - (a.weightKg ?? 0) * a.reps)[0];
        const topSet = top ? ` · ${formatWeight(top.weightKg, units, 0)} x ${top.reps} top set` : "";
        return `${ex?.name ?? "Strength"} · ${entry.sets.length} sets${topSet}`;
      }
      if (entry.kind === "strength") {
        const ex = exerciseById.get(entry.exerciseId);
        const top = entry.sets
          .filter((s) => s.reps > 0)
          .sort((a, b) => (b.weightKg ?? 0) * b.reps - (a.weightKg ?? 0) * a.reps)[0];
        const topSet = top ? ` · ${formatWeight(top.weightKg, units, 0)} x ${top.reps} top set` : "";
        return `${ex?.name ?? "Strength"} · ${entry.sets.length} sets${topSet}`;
      }
      if (entry.kind === "mobility") {
        return `${ACTIVITY_LABELS.mobility} · ${formatDuration(entry.durationMin)}${entry.focusArea ? ` · ${entry.focusArea}` : ""}`;
      }
      const label = ACTIVITY_LABELS[entry.activityType];
      const bits = [label];
      if (entry.distanceM) bits.push(formatDistance(entry.distanceM, units, entry.activityType));
      bits.push(formatDuration(entry.durationMin));
      if (entry.distanceM) bits.push(formatPace(entry.durationMin, entry.distanceM, units, entry.activityType));
      return bits.join(" · ");
    })
    .join(" · ");
}

// ─── PR math ────────────────────────────────────────────────────────────────

/** Epley estimated 1RM. Reps beyond 12 barely move e1RM and get noisy - capped. */
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

/** Bodyweight movements have no meaningful e1RM without added load - best-set reps instead. */
export function bestReps(sets: SetEntry[]): number {
  return Math.max(0, ...sets.map((s) => s.reps));
}

export type PrHit = {
  exerciseId: string;
  exerciseName: string;
  metric: string;
  value: number;
  previous: number | null;
  better: "higher" | "lower";
};

const RUN_BUCKETS = [
  ["pace_1mi", 1609.344, "1 mi"],
  ["pace_5k", 5000, "5K"],
  ["pace_10k", 10000, "10K"],
  ["pace_half_marathon", 21097.5, "half marathon"],
  ["pace_marathon", 42195, "marathon"],
] as const;

function cardioCandidates(entry: CardioLogEntry | MobilityLogEntry): [metric: string, value: number, better: "higher" | "lower"][] {
  const hits: [string, number, "higher" | "lower"][] = [];
  if (entry.durationMin > 0) hits.push(["duration_min", Math.round(entry.durationMin * 10) / 10, "higher"]);
  if (entry.kind === "mobility") return hits;
  if (entry.distanceM && entry.distanceM > 0) {
    hits.push(["distance_m", Math.round(entry.distanceM), "higher"]);
    if (["outdoor_run", "treadmill_run", "walk", "hike"].includes(entry.activityType)) {
      for (const [metric, meters] of RUN_BUCKETS) {
        if (entry.distanceM >= meters * 0.95) hits.push([metric, (entry.durationMin * 60) / (entry.distanceM / meters), "lower"]);
      }
    }
    if (entry.activityType === "rowing") {
      hits.push(["row_split_500m", (entry.durationMin * 60) / (entry.distanceM / 500), "lower"]);
      if (entry.distanceM >= 1900) hits.push(["row_2k", (entry.durationMin * 60) / (entry.distanceM / 2000), "lower"]);
    }
  }
  return hits;
}

function beats(value: number, previous: number | null | undefined, better: "higher" | "lower") {
  if (previous == null) return true;
  return better === "higher" ? value > previous : value < previous;
}

/** Compares a finished session against stored PRs; returns the beats (caller persists them). */
export async function detectPrs(userId: string, entries: WorkoutLogEntries): Promise<PrHit[]> {
  const exerciseIds = entries.flatMap((e) => ("exerciseId" in e && e.exerciseId ? [e.exerciseId] : []));
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
    if (!("exerciseId" in entry) || !entry.exerciseId) continue;
    const ex = exById.get(entry.exerciseId);
    if (!ex) continue;
    let candidates: [metric: string, value: number, better: "higher" | "lower"][] = [];
    if (isLegacyEntry(entry)) {
      if (isLegacyCardio(entry)) {
        const durationMin = entry.sets.reduce((a, s) => a + (s.durationMin ?? 0), 0);
        candidates = durationMin > 0 ? [["duration_min", durationMin, "higher"]] : [];
      } else {
        candidates = ex.isBodyweight
          ? [
              ["reps", bestReps(entry.sets), "higher"],
              ["volume", totalVolume(entry.sets), "higher"],
            ]
          : [
              ["e1rm", Math.round(bestE1rm(entry.sets) * 10) / 10, "higher"],
              ["volume", totalVolume(entry.sets), "higher"],
            ];
      }
    } else if (entry.kind === "strength") {
      candidates = ex.isBodyweight
        ? [
            ["reps", bestReps(entry.sets), "higher"],
            ["volume", totalVolume(entry.sets), "higher"],
          ]
        : [
            ["e1rm", Math.round(bestE1rm(entry.sets) * 10) / 10, "higher"],
            ["volume", totalVolume(entry.sets), "higher"],
          ];
    } else {
      candidates = cardioCandidates(entry);
    }
    for (const [metric, value, better] of candidates) {
      if (value <= 0) continue;
      const prev = prByKey.get(`${entry.exerciseId}|${metric}`);
      if (beats(value, prev?.value, better)) {
        hits.push({ exerciseId: ex.id, exerciseName: ex.name, metric, value, previous: prev?.value ?? null, better });
      }
    }
  }
  return hits;
}

export function prLabel(hit: { metric: string; value: number }, units: UnitsPref): string {
  if (hit.metric === "e1rm") return `${formatWeight(hit.value, units)} est. 1RM`;
  if (hit.metric === "volume") return `${formatWeight(hit.value, units, 0)} total volume`;
  if (hit.metric === "reps") return `${hit.value} reps`;
  if (hit.metric === "distance_m") return `${formatDistance(hit.value, units)} longest distance`;
  if (hit.metric === "duration_min") return `${formatDuration(hit.value)} longest duration`;
  if (hit.metric === "row_split_500m") return `${formatDuration(hit.value / 60)}/500m split`;
  if (hit.metric === "row_2k") return `${formatDuration(hit.value / 60)} 2K row`;
  if (hit.metric.startsWith("pace_")) {
    const label = RUN_BUCKETS.find(([metric]) => metric === hit.metric)?.[2] ?? "distance";
    const unit = units === "imperial" ? "mi" : "km";
    const secondsPerKm = hit.value / (Number(label === "1 mi" ? 1609.344 : label === "5K" ? 5000 : label === "10K" ? 10000 : label === "half marathon" ? 21097.5 : 42195) / 1000);
    const secondsPerUnit = units === "imperial" ? secondsPerKm * 1.609344 : secondsPerKm;
    return `${formatDuration(secondsPerUnit / 60)}/${unit} ${label}`;
  }
  return `${Math.round(hit.value * 10) / 10}`;
}

// ─── queries ────────────────────────────────────────────────────────────────

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
  const exerciseIds = [...new Set(logs.flatMap((l) => l.entries.flatMap((e) => ("exerciseId" in e && e.exerciseId ? [e.exerciseId] : []))))];
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
