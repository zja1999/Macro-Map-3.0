import Link from "next/link";
import { db } from "@/db/client";
import { exercises } from "@/db/schema";
import { getWorkoutWithExercises } from "@/lib/workouts";
import { WorkoutForm, type ExerciseOption } from "@/components/WorkoutForms";

export const metadata = { title: "Create workout" };

export default async function NewWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ fork?: string }>;
}) {
  const { fork: forkId } = await searchParams;
  const exerciseOptions: ExerciseOption[] = (await db.select().from(exercises).orderBy(exercises.name)).map((e) => ({
    id: e.id,
    name: e.name,
    isBodyweight: e.isBodyweight,
    isCardio: e.muscleGroups.includes("cardio"),
    activityType: e.activityType as ExerciseOption["activityType"],
  }));

  // fork = pre-filled new workout with a byline back to the original (docs/06 §4)
  let fork;
  let forkSource;
  if (forkId && /^[0-9a-f-]{36}$/.test(forkId)) {
    const data = await getWorkoutWithExercises(forkId);
    if (data) {
      forkSource = data;
      fork = {
        forkedFromId: data.workout.id,
        title: data.workout.title,
        rows: data.workout.structure.map((s) => ({
          exerciseName: data.exerciseById.get(s.exerciseId)?.name ?? "",
          sets: String(s.sets ?? 1),
          reps: s.reps ?? "",
          durationMin: String(s.targetDurationMin ?? ""),
          distance: s.targetDistanceM ? String(Math.round(s.targetDistanceM / 1609.344 * 100) / 100) : "",
          notes: s.notes ?? "",
        })),
      };
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">{fork ? "Fork workout" : "Create a workout"}</h1>
      {forkSource && (
        <p className="text-xs text-ink-dim">
          Forked from{" "}
          <Link href={`/workouts/${forkSource.workout.id}`} className="text-accent hover:underline">
            {forkSource.workout.title}
          </Link>
          {forkSource.displayName && ` by ${forkSource.displayName}`} — tweak it and publish your version.
        </p>
      )}
      <WorkoutForm exerciseOptions={exerciseOptions} fork={fork} />
    </div>
  );
}
