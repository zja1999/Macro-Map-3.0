import { requireMacroTrayUser } from "@/lib/macrotray";
import { getProgressEntries } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { formatWeight } from "@/lib/units";
import { WeighInForm } from "@/components/ProgressForms";
import { Card } from "@/components/ui";

export default async function MacroTrayWeightPage() {
  const user = await requireMacroTrayUser();
  const units = user.profile.units as "metric" | "imperial";
  const entries = await getProgressEntries(user.id, 1);
  const latest = entries.at(-1);
  return <div className="space-y-3"><div><h1 className="text-base font-bold">Log weight</h1><p className="text-xs text-ink-faint">{latest?.weightKg ? `Last: ${formatWeight(latest.weightKg, units)} on ${latest.entryDate}` : "Your measurements stay private."}</p></div>{user.profile.trackingStyle === "no_scale" && <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-ink-dim">You use no-scale mode, but you can still record a private weigh-in here when you choose.</p>}<Card className="p-3"><WeighInForm today={todayStr()} units={units} collapseMore /></Card></div>;
}
