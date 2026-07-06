"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  personalRecords,
  posts,
  saves,
  users,
  votes,
  workoutLogs,
  workouts,
  type WorkoutLogEntries,
  type WorkoutStructure,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { detectPrs, prLabel } from "@/lib/workouts";

// ─── create / fork a community workout ──────────────────────────────────────

const structureSchema = z
  .array(
    z.object({
      exerciseId: z.string().uuid(),
      kind: z.enum(["strength", "cardio", "mobility", "mixed"]).optional(),
      activityType: z.string().max(40).optional(),
      sets: z.number().int().min(1).max(20).optional(),
      reps: z.string().min(1).max(20).optional(), // "5", "8-12", "AMRAP"
      targetDurationMin: z.number().min(1).max(1440).optional(),
      targetDistanceM: z.number().min(1).max(1000000).optional(),
      notes: z.string().max(120).optional(),
    }),
  )
  .min(1)
  .max(20);

const createSchema = z.object({
  title: z.string().min(3).max(80),
  description: z.string().max(500).optional(),
  kind: z.enum(["strength", "cardio", "mobility", "mixed"]),
  difficulty: z.coerce.number().min(1).max(5).optional(),
  estDurationMin: z.coerce.number().min(5).max(300).optional(),
  forkedFromId: z.string().uuid().optional(),
  structure: structureSchema,
});

export async function createWorkout(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let d: z.infer<typeof createSchema>;
  try {
    d = createSchema.parse({
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      kind: formData.get("kind"),
      difficulty: formData.get("difficulty") || undefined,
      estDurationMin: formData.get("estDurationMin") || undefined,
      forkedFromId: formData.get("forkedFromId") || undefined,
      structure: JSON.parse(String(formData.get("structure") ?? "[]")),
    });
  } catch {
    return { error: "Add a title and at least one exercise." };
  }

  const [workout] = await db
    .insert(workouts)
    .values({
      authorId: user.id,
      forkedFromId: d.forkedFromId ?? null,
      title: d.title,
      description: d.description ?? null,
      kind: d.kind,
      difficulty: d.difficulty ?? null,
      estDurationMin: d.estDurationMin ?? null,
      structure: d.structure as WorkoutStructure,
    })
    .returning({ id: workouts.id });
  redirect(`/workouts/${workout.id}`);
}

// ─── log a session (with PR detection — docs/08 §5 "milestones are detected") ─

const nullableNumber = z.number().finite().nullable().optional();

const strengthEntrySchema = z.object({
  kind: z.literal("strength"),
  activityType: z.literal("strength"),
  exerciseId: z.string().uuid(),
  sets: z
    .array(
      z.object({
        reps: z.number().int().min(1).max(200),
        weightKg: z.number().min(0).max(600).nullable(),
        rpe: z.number().min(1).max(10).nullable().optional(),
        restSec: z.number().int().min(0).max(1800).nullable().optional(),
      }),
    )
    .min(1)
    .max(60),
});

const cardioActivitySchema = z.enum([
  "outdoor_run",
  "treadmill_run",
  "rowing",
  "stationary_bike",
  "outdoor_bike",
  "walk",
  "hike",
  "elliptical",
  "generic_cardio",
]);

const cardioEntrySchema = z.object({
  kind: z.literal("cardio"),
  activityType: cardioActivitySchema,
  exerciseId: z.string().uuid(),
  durationMin: z.number().min(0.5).max(1440),
  distanceM: nullableNumber,
  speedKph: nullableNumber,
  inclinePct: nullableNumber,
  resistance: nullableNumber,
  strokeRate: nullableNumber,
  powerWatts: nullableNumber,
  calories: nullableNumber,
  perceivedEffort: z.number().min(1).max(10).nullable().optional(),
  routeNote: z.string().max(160).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

const mobilityEntrySchema = z.object({
  kind: z.literal("mobility"),
  activityType: z.literal("mobility"),
  exerciseId: z.string().uuid(),
  durationMin: z.number().min(1).max(1440),
  focusArea: z.string().max(80).nullable().optional(),
  perceivedEffort: z.number().min(1).max(10).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

const entriesSchema = z.array(z.discriminatedUnion("kind", [strengthEntrySchema, cardioEntrySchema, mobilityEntrySchema])).min(1).max(20);

const logSchema = z.object({
  workoutId: z.string().uuid().optional(),
  durationMin: z.coerce.number().min(1).max(600).optional(),
  notes: z.string().max(500).optional(),
  entries: entriesSchema,
});

export async function logWorkout(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let d: z.infer<typeof logSchema>;
  try {
    d = logSchema.parse({
      workoutId: formData.get("workoutId") || undefined,
      durationMin: formData.get("durationMin") || undefined,
      notes: formData.get("notes") || undefined,
      entries: JSON.parse(String(formData.get("entries") ?? "[]")),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issue = err.issues[0];
      if (issue?.path.includes("reps")) {
        return { error: "Reps must be whole numbers. Use notes for partial reps." };
      }
      if (issue?.path.includes("weightKg")) {
        return { error: "Check the weight for each set." };
      }
    }
    return { error: "Choose an exercise and enter at least one completed set." };
  }

  const entries = d.entries as WorkoutLogEntries;
  const hits = await detectPrs(user.id, entries);
  const entryDuration = Math.max(
    0,
    ...entries.map((entry) => ("durationMin" in entry && typeof entry.durationMin === "number" ? entry.durationMin : 0)),
  );

  const logId = await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(workoutLogs)
      .values({
        userId: user.id,
        workoutId: d.workoutId ?? null,
        durationMin: d.durationMin ?? (entryDuration > 0 ? Math.round(entryDuration) : null),
        notes: d.notes ?? null,
        entries,
      })
      .returning({ id: workoutLogs.id });

    for (const hit of hits) {
      const where = and(
        eq(personalRecords.userId, user.id),
        eq(personalRecords.exerciseId, hit.exerciseId),
        eq(personalRecords.metric, hit.metric),
      );
      const [existing] = await tx.select().from(personalRecords).where(where);
      const isLowerBetter = hit.better === "lower";
      const shouldPersist = !existing || (isLowerBetter ? hit.value < existing.value : hit.value > existing.value);
      if (existing && shouldPersist) {
        await tx
          .update(personalRecords)
          .set({ value: hit.value, achievedAt: new Date(), workoutLogId: log.id })
          .where(where);
      } else if (!existing) {
        await tx.insert(personalRecords).values({
          userId: user.id,
          exerciseId: hit.exerciseId,
          metric: hit.metric,
          value: hit.value,
          workoutLogId: log.id,
        });
      }
    }

    // completing community content is a ranking + reputation signal (docs/06 §5, §8)
    if (d.workoutId) {
      const [w] = await tx.select().from(workouts).where(eq(workouts.id, d.workoutId)).limit(1);
      if (w) {
        await tx
          .update(workouts)
          .set({ completedCount: sql`${workouts.completedCount} + 1` })
          .where(eq(workouts.id, d.workoutId));
        if (w.authorId && w.authorId !== user.id) {
          await tx
            .update(users)
            .set({ reputation: sql`${users.reputation} + 5` })
            .where(eq(users.id, w.authorId));
        }
      }
    }
    return log.id;
  });

  // PRs surface as an offered share, never an automatic post (docs/08 §5.4)
  const units = user.profile.units as "metric" | "imperial";
  const prParam = hits.length
    ? `&prs=${encodeURIComponent(hits.map((h) => `${h.exerciseName}: ${prLabel(h, units)}`).join(" · "))}`
    : "";
  redirect(`/workouts?logged=${logId}${prParam}`);
}

/** One-click share of a detected PR as a feed post (type personal_record). */
export async function sharePr(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const body = z.string().min(3).max(300).parse(formData.get("body"));
  await db.insert(posts).values({ authorId: user.id, type: "personal_record", body });
  redirect("/");
}

/** Upvote/downvote a community workout — mirrors recipe voting (docs/06 §5, §8):
 * the score ranks it and the author earns reputation for upvotes. */
export async function voteWorkout(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workoutId = z.string().uuid().parse(formData.get("workoutId"));
  const value = z.coerce.number().refine((v) => v === 1 || v === -1).parse(formData.get("value")) as 1 | -1;

  const [workout] = await db.select().from(workouts).where(eq(workouts.id, workoutId)).limit(1);
  if (!workout) throw new Error("Workout not found");
  if (workout.authorId === user.id) return; // no self-votes

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(votes)
      .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "workout"), eq(votes.subjectId, workoutId)));

    let up = 0;
    let down = 0;
    if (existing && existing.value === value) {
      await tx
        .delete(votes)
        .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "workout"), eq(votes.subjectId, workoutId)));
      value === 1 ? (up = -1) : (down = -1);
    } else if (existing) {
      await tx
        .update(votes)
        .set({ value })
        .where(and(eq(votes.userId, user.id), eq(votes.subjectType, "workout"), eq(votes.subjectId, workoutId)));
      if (value === 1) {
        up = 1;
        down = -1;
      } else {
        up = -1;
        down = 1;
      }
    } else {
      await tx.insert(votes).values({ userId: user.id, subjectType: "workout", subjectId: workoutId, value });
      value === 1 ? (up = 1) : (down = 1);
    }
    await tx
      .update(workouts)
      .set({
        upvotes: sql`${workouts.upvotes} + ${up}`,
        downvotes: sql`${workouts.downvotes} + ${down}`,
      })
      .where(eq(workouts.id, workoutId));
  });
  if (workout.authorId && workout.authorId !== user.id) {
    await db
      .update(users)
      .set({ reputation: sql`GREATEST(0, ${users.reputation} + ${value === 1 ? 2 : -1})` })
      .where(eq(users.id, workout.authorId));
  }
  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/workouts");
}

export async function toggleSaveWorkout(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const workoutId = z.string().uuid().parse(formData.get("workoutId"));

  const [workout] = await db.select().from(workouts).where(eq(workouts.id, workoutId)).limit(1);
  if (!workout) throw new Error("Workout not found");

  const where = and(eq(saves.userId, user.id), eq(saves.subjectType, "workout"), eq(saves.subjectId, workoutId));
  const [existing] = await db.select().from(saves).where(where);
  await db.transaction(async (tx) => {
    if (existing) {
      await tx.delete(saves).where(where);
      await tx.update(workouts).set({ saveCount: sql`${workouts.saveCount} - 1` }).where(eq(workouts.id, workoutId));
    } else {
      await tx.insert(saves).values({ userId: user.id, subjectType: "workout", subjectId: workoutId });
      await tx.update(workouts).set({ saveCount: sql`${workouts.saveCount} + 1` }).where(eq(workouts.id, workoutId));
    }
  });
  if (!existing && workout.authorId && workout.authorId !== user.id) {
    await db.update(users).set({ reputation: sql`${users.reputation} + 3` }).where(eq(users.id, workout.authorId));
  }
  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/workouts");
}
