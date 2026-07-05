import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { saves } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getWorkoutWithExercises } from "@/lib/workouts";
import { toggleSaveWorkout } from "@/actions/workouts";
import { Card, Badge, btnGhost } from "@/components/ui";

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const data = await getWorkoutWithExercises(id);
  if (!data) notFound();
  const { workout, username, displayName, exerciseById } = data;

  const [saved] = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, user.id), eq(saves.subjectType, "workout"), eq(saves.subjectId, id)));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold leading-tight">{workout.title}</h1>
          <form action={toggleSaveWorkout} className="shrink-0">
            <input type="hidden" name="workoutId" value={workout.id} />
            <button
              className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                saved ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:text-accent"
              }`}
            >
              {saved ? "🔖 Saved" : "🔖 Save"}
            </button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          {workout.isTemplate ? (
            <Badge tone="accent">official template</Badge>
          ) : displayName ? (
            <Link href={`/u/${username}`} className="hover:text-accent">
              by {displayName}
            </Link>
          ) : null}
          <Badge>{workout.kind}</Badge>
          {workout.difficulty && <Badge>difficulty {workout.difficulty}/5</Badge>}
          {workout.estDurationMin && <Badge>~{workout.estDurationMin} min</Badge>}
          {workout.completedCount > 0 && <span>✓ completed {workout.completedCount}×</span>}
          {workout.saveCount > 0 && <span>🔖 {workout.saveCount}</span>}
        </div>
        {workout.description && <p className="text-sm text-ink-dim">{workout.description}</p>}
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Structure</h2>
        <ul className="divide-y divide-edge">
          {workout.structure.map((s, i) => {
            const ex = exerciseById.get(s.exerciseId);
            return (
              <li key={i} className="flex items-baseline justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{ex?.name ?? "Unknown exercise"}</span>
                  {ex && ex.muscleGroups.length > 0 && (
                    <span className="ml-2 text-[10px] text-ink-faint">{ex.muscleGroups.join(", ")}</span>
                  )}
                  {s.notes && <div className="text-[11px] text-ink-faint">{s.notes}</div>}
                </div>
                <span className="tabular-nums text-ink-dim">
                  {s.sets} × {s.reps}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex gap-2">
        <Link
          href={`/workouts/log?from=${workout.id}`}
          className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-bold text-black"
        >
          Start this workout
        </Link>
        <Link href={`/workouts/new?fork=${workout.id}`} className={btnGhost}>
          ⑂ Fork
        </Link>
      </div>
      <p className="text-center text-[10px] text-ink-faint">
        Completing it logs a session under your account and credits the creator.
      </p>
    </div>
  );
}
