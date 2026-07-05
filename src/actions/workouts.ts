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
      sets: z.number().int().min(1).max(20),
      reps: z.string().min(1).max(20), // "5", "8-12", "AMRAP"
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

const entriesSchema = z
  .array(
    z.object({
      exerciseId: z.string().uuid(),
      sets: z
        .array(z.object({ reps: z.number().int().min(1).max(200), weightKg: z.number().min(0).max(600).nullable() }))
        .min(1)
        .max(20),
    }),
  )
  .min(1)
  .max(20);

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
  } catch {
    return { error: "Log at least one exercise with one completed set." };
  }

  const entries = d.entries as WorkoutLogEntries;
  const hits = await detectPrs(user.id, entries);

  const logId = await db.transaction(async (tx) => {
    const [log] = await tx
      .insert(workoutLogs)
      .values({
        userId: user.id,
        workoutId: d.workoutId ?? null,
        durationMin: d.durationMin ?? null,
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
      if (existing) {
        await tx
          .update(personalRecords)
          .set({ value: hit.value, achievedAt: new Date(), workoutLogId: log.id })
          .where(where);
      } else {
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
  const prParam = hits.length
    ? `&prs=${encodeURIComponent(hits.map((h) => `${h.exerciseName}: ${prLabel(h)}`).join(" · "))}`
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
