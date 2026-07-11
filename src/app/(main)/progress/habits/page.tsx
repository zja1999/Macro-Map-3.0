import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ensureDefaultHabits } from "@/actions/progress";
import { getHabitsWithStreaks, getWeekSummary } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { HabitsSection } from "@/components/HabitsSection";
import { btnGhost } from "@/components/ui";

export const metadata = { title: "Habit check-in" };

export default async function HabitCheckInPage() {
  const user = await requireUser();
  const today = todayStr();
  await ensureDefaultHabits(user.id);
  const [habits, week] = await Promise.all([
    getHabitsWithStreaks(user.id, today),
    getWeekSummary(user.id, today),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold">Habit check-in</h1>
          <p className="text-xs text-ink-faint">A focused place for today&apos;s consistency.</p>
        </div>
        <Link href="/progress" className={btnGhost}>All progress</Link>
      </div>
      <HabitsSection habits={habits} today={today} loggedDays={week.length} />
    </div>
  );
}
