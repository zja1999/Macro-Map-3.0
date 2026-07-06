import { db } from "@/db/client";
import { exercises, type ActivityType } from "@/db/schema";
import { getWorkoutWithExercises } from "@/lib/workouts";
import { requireUser } from "@/lib/auth";
import { WorkoutLogger, type CardioPrefill, type ExerciseOption } from "@/components/WorkoutForms";

export const metadata = { title: "Log workout" };

const MI_PER_M = 0.000621371;

// planned distance (meters) → the number the matching logger expects in its field
function displayDistance(meters: number | undefined, units: "metric" | "imperial", activityType: ActivityType): string {
  if (!meters || meters <= 0) return "";
  if (activityType === "rowing") return String(Math.round(meters));
  const value = units === "imperial" ? meters * MI_PER_M : meters / 1000;
  return String(Math.round(value * 100) / 100);
}

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
  let initialActivity: ActivityType | undefined;
  let cardioPrefill: CardioPrefill | undefined;
  let droppedMovements: string[] = [];
  let title = "Log a session";
  if (from && /^[0-9a-f-]{36}$/.test(from)) {
    const data = await getWorkoutWithExercises(from);
    if (data) {
      workoutId = data.workout.id;
      title = data.workout.title;
      const typed = data.workout.structure.map((s) => ({
        s,
        activityType: (s.activityType ?? data.exerciseById.get(s.exerciseId)?.activityType ?? "strength") as ActivityType,
      }));
      const strengthEntries = typed.filter((t) => t.activityType === "strength");

      if (strengthEntries.length) {
        // strength (and mixed) templates prefill the strength logger's exercise list
        prefill = strengthEntries.map(({ s }) => {
          // Templates express timed isometric holds as a seconds string in `reps`
          // (e.g. a plank planned as "45s"). Those log a hold time, not reps/weight.
          const holdMatch = /^\s*(\d+)\s*s(ec(onds?)?)?\s*$/i.exec(s.reps ?? "");
          const isHold = !!holdMatch;
          const holdSec = holdMatch ? holdMatch[1] : "";
          return {
            exerciseName: data.exerciseById.get(s.exerciseId)?.name ?? "",
            isHold,
            sets: Array.from({ length: s.sets ?? 1 }, () => ({ reps: "", weight: "", rpe: "", restSec: "", holdSec })),
          };
        });
        // a mixed template's cardio/mobility movements can't ride in the strength
        // logger — call them out so they aren't silently dropped
        droppedMovements = typed
          .filter((t) => t.activityType !== "strength")
          .map((t) => data.exerciseById.get(t.s.exerciseId)?.name ?? "");
      } else if (typed.length) {
        // pure cardio/mobility template: open the right logger and prefill its plan
        const first = typed[0];
        initialActivity = first.activityType;
        cardioPrefill = {
          durationMin: first.s.targetDurationMin ? String(first.s.targetDurationMin) : "",
          distance: displayDistance(first.s.targetDistanceM, units, first.activityType),
          notes: first.s.notes ?? "",
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-lg font-bold">Log workout</h1>
      <p className="text-xs text-ink-dim">
        {workoutId
          ? `Starting from ${title}. Your session opens on the right activity with the plan prefilled — adjust anything before you save.`
          : "Pick the activity first so MacroVerse asks for the right data: weights for lifting, distance and pace for runs, meters and split for rowing."}
      </p>
      {droppedMovements.length > 0 && (
        <p className="rounded-lg border border-carbs/40 bg-carbs/10 px-3 py-2 text-[11px] text-carbs">
          This template also includes {droppedMovements.join(", ")}. Log {droppedMovements.length === 1 ? "it" : "them"} as a
          separate cardio/mobility session from the activity picker.
        </p>
      )}
      <WorkoutLogger
        exerciseOptions={exerciseOptions}
        workoutId={workoutId}
        prefill={prefill}
        units={units}
        initialActivity={initialActivity}
        cardioPrefill={cardioPrefill}
      />
    </div>
  );
}
