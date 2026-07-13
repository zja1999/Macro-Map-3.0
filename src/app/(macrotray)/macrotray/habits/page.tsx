import { ensureDefaultHabits } from "@/actions/progress";
import { requireMacroTrayUser } from "@/lib/macrotray";
import { getHabitsWithStreaks, getWeekSummary } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { HabitsSection } from "@/components/HabitsSection";

export default async function MacroTrayHabitsPage() {
  const user = await requireMacroTrayUser();
  const today = todayStr();
  await ensureDefaultHabits(user.id);
  const [habits, week] = await Promise.all([getHabitsWithStreaks(user.id, today), getWeekSummary(user.id, today)]);
  return <div className="space-y-3"><div><h1 className="text-base font-bold">Habit check-in</h1><p className="text-xs text-ink-faint">Tap each habit you completed today.</p></div><HabitsSection habits={habits} today={today} loggedDays={week.length}/></div>;
}
