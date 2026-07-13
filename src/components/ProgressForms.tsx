"use client";

import { useActionState, useState } from "react";
import { saveProgressEntry } from "@/actions/progress";
import type { UnitsPref } from "@/lib/units";
import { inputCls, btnPrimary, btnGhost } from "./ui";

export function WeighInForm({ today, units, collapseMore = false }: { today: string; units: UnitsPref; collapseMore?: boolean }) {
  const [state, action, pending] = useActionState(saveProgressEntry, undefined);
  const [showMore, setShowMore] = useState(false);
  const weightUnit = units === "imperial" ? "lb" : "kg";
  const lengthUnit = units === "imperial" ? "in" : "cm";
  // imperial max/min widened from the metric bounds so the same server-side
  // conversion range (20-400kg / 10-250cm) isn't clipped before it reaches the action
  const weightBounds = units === "imperial" ? { min: 44, max: 880 } : { min: 20, max: 400 };
  const lengthBounds = units === "imperial" ? { min: 4, max: 98 } : { min: 10, max: 250 };

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entryDate" value={today} />
      <input type="hidden" name="units" value={units} />
      <div className="flex gap-2">
        <label className="min-w-0 flex-1 space-y-1 text-[10px] text-ink-dim">
          Weight ({weightUnit})
          <input type="number" name="weight" step="0.1" {...weightBounds} className={inputCls} autoFocus />
        </label>
        {!collapseMore && <label className="min-w-0 flex-1 space-y-1 text-[10px] text-ink-dim">
          Body fat % <span className="text-ink-faint">(optional)</span>
          <input type="number" name="bodyFatPct" step="0.1" min={1} max={75} className={inputCls} />
        </label>}
      </div>

      {showMore && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {collapseMore && <label className="space-y-1 text-[10px] text-ink-dim">
            Body fat %
            <input type="number" name="bodyFatPct" step="0.1" min={1} max={75} className={inputCls} />
          </label>}
          {(
            [
              ["waist", `Waist (${lengthUnit})`],
              ["chest", `Chest (${lengthUnit})`],
              ["hips", `Hips (${lengthUnit})`],
              ["arms", `Arms (${lengthUnit})`],
            ] as const
          ).map(([name, label]) => (
            <label key={name} className="space-y-1 text-[10px] text-ink-dim">
              {label}
              <input type="number" name={name} step="0.1" {...lengthBounds} className={inputCls} />
            </label>
          ))}
          <label className="col-span-2 space-y-1 text-[10px] text-ink-dim sm:col-span-4">
            Note
            <input name="note" maxLength={300} placeholder="How's it going?" className={inputCls} />
          </label>
        </div>
      )}

      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      {state?.ok && <p className="text-xs font-semibold text-accent">Entry saved.</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save entry"}
        </button>
        <button type="button" onClick={() => setShowMore(!showMore)} className={btnGhost}>
          {showMore ? "Less" : collapseMore ? "More" : "+ Measurements"}
        </button>
      </div>
      <p className="text-[10px] text-ink-faint">
        Progress data is <span className="font-medium text-ink-dim">private by default</span> — nothing here is shared
        unless you post it yourself.
      </p>
    </form>
  );
}
