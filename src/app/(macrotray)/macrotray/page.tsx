import Link from "next/link";
import { Droplets, Dumbbell, ListChecks, MapPin, Scale, UtensilsCrossed } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getDayLogs, getHabitsWithStreaks } from "@/lib/queries";
import { getRecentWorkoutLogs } from "@/lib/workouts";
import { todayStr } from "@/lib/utils";
import { formatWater } from "@/lib/units";
import { MacroTrayConnect } from "@/components/MacroTrayConnect";

const actions = [
  { href: "/macrotray/meal", label: "Meal", hint: "Search, saved, or quick add", icon: UtensilsCrossed },
  { href: "/macrotray/workout", label: "Workout", hint: "Full session logger", icon: Dumbbell },
  { href: "/macrotray/restaurants", label: "Restaurants", hint: "Find a macro-friendly meal", icon: MapPin },
  { href: "/macrotray/weight", label: "Weight", hint: "Weigh-in and measurements", icon: Scale },
  { href: "/macrotray/water", label: "Water", hint: "Update today’s total", icon: Droplets },
  { href: "/macrotray/habits", label: "Habits", hint: "Check in for today", icon: ListChecks },
] as const;

export default async function MacroTrayHome() {
  const user = await getCurrentUser();
  if (!user?.profile.onboardedAt) return <MacroTrayConnect />;
  const today = todayStr();
  const [{ logs, waterMl }, habits, workoutData] = await Promise.all([
    getDayLogs(user.id, today),
    getHabitsWithStreaks(user.id, today),
    getRecentWorkoutLogs(user.id, 1),
  ]);
  const calories = Math.round(logs.reduce((sum, row) => sum + row.calories, 0));
  const habitsDone = habits.filter((h) => h.doneToday).length;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent/25 bg-accent/5 p-3">
        <p className="text-xs text-ink-faint">Today</p>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-base font-bold">{calories}</div><div className="text-[10px] text-ink-faint">kcal</div></div>
          <div><div className="text-base font-bold">{formatWater(waterMl, user.profile.units as "metric" | "imperial")}</div><div className="text-[10px] text-ink-faint">water</div></div>
          <div><div className="text-base font-bold">{habitsDone}/{habits.length}</div><div className="text-[10px] text-ink-faint">habits</div></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => <Link key={action.href} href={action.href} className="rounded-xl border border-edge bg-card p-3 transition hover:border-accent/50 hover:bg-card-hover"><action.icon size={19} className="text-accent" /><div className="mt-2 text-sm font-bold">{action.label}</div><div className="mt-0.5 text-[10px] leading-4 text-ink-faint">{action.hint}</div></Link>)}
      </div>
      {workoutData.logs[0] && <p className="text-center text-[10px] text-ink-faint">Last workout logged {new Date(workoutData.logs[0].performedAt).toLocaleDateString()}</p>}
    </div>
  );
}
