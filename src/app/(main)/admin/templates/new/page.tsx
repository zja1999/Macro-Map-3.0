import Link from "next/link";
import { db } from "@/db/client";
import { exercises } from "@/db/schema";
import { requireAdmin } from "@/lib/permissions";
import { WorkoutForm, type ExerciseOption, type TemplateEdit } from "@/components/WorkoutForms";

export const metadata = { title: "New template" };

const BLANK: TemplateEdit = {
  title: "",
  description: "",
  kind: "strength",
  difficulty: "",
  estDurationMin: "",
  rows: [{ exerciseName: "", sets: "3", reps: "8-12", durationMin: "", distance: "", notes: "" }],
};

export default async function NewTemplatePage() {
  await requireAdmin();
  const exerciseOptions: ExerciseOption[] = (await db.select().from(exercises).orderBy(exercises.name)).map((e) => ({
    id: e.id,
    name: e.name,
    isBodyweight: e.isBodyweight,
    isCardio: e.muscleGroups.includes("cardio"),
    activityType: e.activityType as ExerciseOption["activityType"],
  }));

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">New official template</h1>
        <Link href="/admin/templates" className="text-xs text-accent hover:underline">
          ← All templates
        </Link>
      </div>
      <WorkoutForm exerciseOptions={exerciseOptions} template={BLANK} />
    </div>
  );
}
