import { db } from "@/db/client";
import { exercises } from "@/db/schema";
import { getWorkoutWithExercises } from "@/lib/workouts";
import { requireUser } from "@/lib/auth";
import { WorkoutLogger, type ExerciseOption } from "@/components/WorkoutForms";

export const metadata = { title: "Log workout" };

export default async function LogWorkoutPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const user = await requireUser();
  const units = user.profile.units as "metric" | "imperial";
  const exerciseRows = await db.select().from(exercises).orderBy(exercises.name);
  const exerciseOptions: ExerciseOption[] = exerciseRows.map((e) => ({
    id: e.id,
    name: e.name,
    isBodyweight: e.isBodyweight,
    isCardio: e.muscleGroups.includes("cardio"),
    activityType: e.activityType as ExerciseOption["activityType"],
  }));

  let workoutId: string | undefined;
  let prefill;
  let title = "Log a session";
  if (from && /^[0-9a-f-]{36}$/.test(from)) {
    const data = await getWorkoutWithExercises(from);
    if (data) {
      workoutId = data.workout.id;
      title = data.workout.title;
      prefill = data.workout.structure
        .filter((s) => (s.activityType ?? data.exerciseById.get(s.exerciseId)?.activityType ?? "strength") === "strength")
        .map((s) => ({
          exerciseName: data.exerciseById.get(s.exerciseId)?.name ?? "",
          sets: Array.from({ length: s.sets ?? 1 }, () => ({ reps: "", weight: "", rpe: "", restSec: "" })),
        }));
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">Log workout</h1>
      <p className="text-xs text-ink-dim">
        {workoutId
          ? `Starting from ${title}. Strength templates prefill their exercise list; cardio templates can be logged from the activity cards below.`
          : "Pick the activity first so MacroVerse asks for the right data: weights for lifting, distance and pace for runs, meters and split for rowing."}
      </p>
      <WorkoutLogger exerciseOptions={exerciseOptions} workoutId={workoutId} prefill={prefill} units={units} />
    </div>
  );
}
