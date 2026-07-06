import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { exercises } from "@/db/schema";
import { requireAdmin } from "@/lib/permissions";
import { getWorkoutWithExercises, structureToRows } from "@/lib/workouts";
import { WorkoutForm, type ExerciseOption, type TemplateEdit } from "@/components/WorkoutForms";

export const metadata = { title: "Edit template" };

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const data = await getWorkoutWithExercises(id);
  if (!data || !data.workout.isTemplate) notFound();
  const { workout, exerciseById } = data;
  const units = (user.profile.units ?? "imperial") as "metric" | "imperial";

  const exerciseOptions: ExerciseOption[] = (await db.select().from(exercises).orderBy(exercises.name)).map((e) => ({
    id: e.id,
    name: e.name,
    isBodyweight: e.isBodyweight,
    isCardio: e.muscleGroups.includes("cardio"),
    activityType: e.activityType as ExerciseOption["activityType"],
  }));

  const template: TemplateEdit = {
    id: workout.id,
    title: workout.title,
    description: workout.description ?? "",
    kind: workout.kind,
    difficulty: workout.difficulty != null ? String(workout.difficulty) : "",
    estDurationMin: workout.estDurationMin != null ? String(workout.estDurationMin) : "",
    rows: structureToRows(workout.structure, exerciseById, units),
  };

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Edit template</h1>
        <Link href="/admin/templates" className="text-xs text-accent hover:underline">
          ← All templates
        </Link>
      </div>
      <WorkoutForm exerciseOptions={exerciseOptions} template={template} />
    </div>
  );
}
