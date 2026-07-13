import { db } from "@/db/client";
import { exercises } from "@/db/schema";
import { requireMacroTrayUser } from "@/lib/macrotray";
import { WorkoutLogger, type ExerciseOption } from "@/components/WorkoutForms";

export default async function MacroTrayWorkoutPage() {
  const user = await requireMacroTrayUser();
  const rows = await db.select().from(exercises).orderBy(exercises.name);
  const exerciseOptions: ExerciseOption[] = rows.map((e) => ({ id: e.id, name: e.name, isBodyweight: e.isBodyweight, isCardio: e.muscleGroups.includes("cardio"), activityType: e.activityType as ExerciseOption["activityType"] }));
  return <div className="space-y-3 pb-8"><div><h1 className="text-base font-bold">Log workout</h1><p className="text-xs text-ink-faint">Choose an activity, enter the full session, then save.</p></div><WorkoutLogger exerciseOptions={exerciseOptions} units={user.profile.units as "metric" | "imperial"}/></div>;
}
