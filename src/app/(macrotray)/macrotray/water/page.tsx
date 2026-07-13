import { addWater } from "@/actions/logging";
import { requireMacroTrayUser } from "@/lib/macrotray";
import { getDayLogs } from "@/lib/queries";
import { formatWater } from "@/lib/units";
import { todayStr } from "@/lib/utils";
import { Card, inputCls, btnPrimary, btnGhost } from "@/components/ui";

export default async function MacroTrayWaterPage() {
  const user = await requireMacroTrayUser();
  const date = todayStr();
  const { waterMl } = await getDayLogs(user.id, date);
  const imperial = user.profile.units === "imperial";
  const presets = imperial
    ? [{ label: "+8 oz", ml: 237 }, { label: "+12 oz", ml: 355 }, { label: "+16 oz", ml: 473 }]
    : [{ label: "+250 ml", ml: 250 }, { label: "+500 ml", ml: 500 }, { label: "+750 ml", ml: 750 }];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-base font-bold">Water</h1>
        <p className="text-xs text-ink-faint">Update today&apos;s running total.</p>
      </div>
      <Card className="p-4 text-center">
        <div className="text-3xl font-black text-accent">{formatWater(waterMl, user.profile.units as "metric" | "imperial")}</div>
        <div className="mt-1 text-xs text-ink-faint">logged today</div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <form action={addWater} key={preset.ml}>
              <input type="hidden" name="logDate" value={date} />
              <input type="hidden" name="ml" value={preset.ml} />
              <button className={`${btnPrimary} w-full px-2`}>{preset.label}</button>
            </form>
          ))}
        </div>
        <form action={addWater} className="mt-3 flex gap-2">
          <input type="hidden" name="logDate" value={date} />
          <input type="hidden" name="waterUnit" value={imperial ? "fl_oz" : "ml"} />
          <input
            name="amount"
            type="number"
            step="0.1"
            min={imperial ? -33 : -1000}
            max={imperial ? 67 : 2000}
            required
            placeholder={`Custom ${imperial ? "fl oz" : "ml"} (+ or -)`}
            className={inputCls}
          />
          <button className={btnGhost}>Update</button>
        </form>
      </Card>
    </div>
  );
}
