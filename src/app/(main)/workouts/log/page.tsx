import { db } from "@/db/client";
import { exercises } from "@/db/schema";
import { getWorkoutWithExercises } from "@/lib/workouts";
import { WorkoutLogger } from "@/components/WorkoutForms";

export const metadata = { title: "Log workout" };

export default async function LogWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const exerciseOptions = await db.select().from(exercises).orderBy(exercises.name);

  // starting from a community workout pre-fills the planned exercises/sets
  let workoutId: string | undefined;
  let prefill;
  let title = "Log a session";
  if (from && /^[0-9a-f-]{36}$/.test(from)) {
    const data = await getWorkoutWithExercises(from);
    if (data) {
      workoutId = data.workout.id;
      title = data.workout.title;
      prefill = data.workout.structure.map((s) => ({
        exerciseName: data.exerciseById.get(s.exerciseId)?.name ?? "",
        sets: Array.from({ length: s.sets }, () => ({ reps: "", weightKg: "" })),
      }));
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">🏋️ {title}</h1>
      <p className="text-xs text-ink-dim">
        Weight in kg (leave blank for bodyweight). PRs are detected automatically when you finish — estimated 1RM,
        volume, and rep records per exercise.
      </p>
      <WorkoutLogger exerciseOptions={exerciseOptions} workoutId={workoutId} prefill={prefill} />
    </div>
  );
}
