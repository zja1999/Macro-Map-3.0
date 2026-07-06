"use client";

import { useActionState, useState } from "react";
import { updateBiometrics, updateProfile, updateTargets } from "@/actions/onboarding";
import { claimAccount } from "@/actions/auth";
import { inputCls, btnPrimary } from "./ui";
import { CALORIE_FLOOR } from "@/lib/targets";
import { cmToFtIn, kgToLb } from "@/lib/units";

/** Guest → real account: attaches email/password to the same users row (docs/08 §1a). */
export function ClaimAccountForm() {
  const [state, action, pending] = useActionState(claimAccount, undefined);
  return (
    <form id="claim" action={action} className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <h2 className="text-sm font-semibold">💾 Save your progress</h2>
      <p className="text-xs text-ink-dim">
        You&apos;re in guest mode — everything you&apos;ve logged stays with this account once you add an email and
        password. No data is lost or migrated.
      </p>
      <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputCls} />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Password (8+ characters)"
        autoComplete="new-password"
        className={inputCls}
      />
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Claiming…" : "Claim my account"}
      </button>
    </form>
  );
}

export function SettingsForms({
  profile,
  targets,
}: {
  profile: {
    displayName: string;
    bio: string;
    dietaryStyle: string;
    shareMacroGoals: boolean;
    units: "metric" | "imperial";
    goal: string;
    trackingStyle: string;
    sex: "male" | "female";
    heightCm: number;
    weightKg: number;
    birthYear: number;
    activityLevel: string;
  };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number; isManual: boolean };
}) {
  const [pState, pAction, pPending] = useActionState(updateProfile, undefined);
  const [tState, tAction, tPending] = useActionState(updateTargets, undefined);
  const [bState, bAction, bPending] = useActionState(updateBiometrics, undefined);
  const [units, setUnits] = useState(profile.units);
  const age = Math.max(13, new Date().getFullYear() - profile.birthYear);
  const heightFtIn = cmToFtIn(profile.heightCm);

  return (
    <div className="space-y-8">
      <form action={pAction} className="space-y-3 rounded-xl border border-edge bg-card p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <label className="block space-y-1 text-xs text-ink-dim">
          Display name
          <input name="displayName" defaultValue={profile.displayName} required maxLength={40} className={inputCls} />
        </label>
        <label className="block space-y-1 text-xs text-ink-dim">
          Bio
          <textarea name="bio" defaultValue={profile.bio} maxLength={280} rows={3} className={`${inputCls} resize-none`} />
        </label>
        <label className="block space-y-1 text-xs text-ink-dim">
          Dietary style
          <input name="dietaryStyle" defaultValue={profile.dietaryStyle} maxLength={40} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-dim">
          <input type="checkbox" name="shareMacroGoals" value="true" defaultChecked={profile.shareMacroGoals} />
          Show my macro targets on my public profile
        </label>
        <div className="space-y-1 text-xs text-ink-dim">
          Units (weight, height, water)
          <input type="hidden" name="units" value={units} />
          <div className="flex gap-1">
            {(["imperial", "metric"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-center text-xs capitalize ${
                  units === u ? "border-accent bg-accent/10 font-semibold text-accent" : "border-edge bg-card"
                }`}
              >
                {u === "imperial" ? "lb / ft-in / fl oz" : "kg / cm / L"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button disabled={pPending} className={btnPrimary}>
            {pPending ? "Saving…" : "Save profile"}
          </button>
          {pState?.ok && <span className="text-xs text-accent">Saved ✓</span>}
          {pState?.error && <span className="text-xs text-danger">{pState.error}</span>}
        </div>
      </form>

      <form action={bAction} className="space-y-3 rounded-xl border border-edge bg-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Macro calculation profile</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Update the measurements and goal used for automatic macro targets. Saving here switches targets back to auto-calculated.
          </p>
        </div>
        <input type="hidden" name="units" value={units} />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] text-ink-dim">
            Goal
            <select name="goal" defaultValue={profile.goal} className={inputCls}>
              <option value="fat_loss">Fat loss</option>
              <option value="muscle_gain">Muscle gain</option>
              <option value="maintenance">Maintenance</option>
              <option value="recomp">Recomp</option>
              <option value="performance">Performance</option>
              <option value="general_health">General health</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Tracking style
            <select name="trackingStyle" defaultValue={profile.trackingStyle} className={inputCls}>
              <option value="strict_macro">Strict macros</option>
              <option value="calorie_only">Calories only</option>
              <option value="protein_focused">Protein focused</option>
              <option value="habit">Habit focused</option>
              <option value="maintenance">Maintenance</option>
              <option value="performance">Performance</option>
              <option value="no_scale">No scale</option>
            </select>
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Sex
            <select name="sex" defaultValue={profile.sex} className={inputCls}>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Activity
            <select name="activityLevel" defaultValue={profile.activityLevel} className={inputCls}>
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="very">Very active</option>
              <option value="extra">Extra active</option>
            </select>
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Age
            <input type="number" name="age" min={13} max={100} defaultValue={age} className={inputCls} />
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Weight ({units === "imperial" ? "lb" : "kg"})
            <input
              type="number"
              name="weight"
              step="0.1"
              min={units === "imperial" ? 66 : 30}
              max={units === "imperial" ? 660 : 300}
              defaultValue={units === "imperial" ? kgToLb(profile.weightKg).toFixed(1) : profile.weightKg.toFixed(1)}
              className={inputCls}
            />
          </label>
          {units === "imperial" ? (
            <>
              <label className="space-y-1 text-[10px] text-ink-dim">
                Height (ft)
                <input type="number" name="heightFt" min={3} max={8} defaultValue={heightFtIn.ft} className={inputCls} />
              </label>
              <label className="space-y-1 text-[10px] text-ink-dim">
                Height (in)
                <input type="number" name="heightIn" min={0} max={11} defaultValue={heightFtIn.inches} className={inputCls} />
              </label>
            </>
          ) : (
            <label className="space-y-1 text-[10px] text-ink-dim">
              Height (cm)
              <input type="number" name="heightCm" min={100} max={250} defaultValue={Math.round(profile.heightCm)} className={inputCls} />
            </label>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button disabled={bPending} className={btnPrimary}>
            {bPending ? "Recalculating..." : "Recalculate targets"}
          </button>
          {bState?.ok && <span className="text-xs text-accent">Targets updated</span>}
          {bState?.error && <span className="text-xs text-danger">{bState.error}</span>}
        </div>
      </form>

      <form action={tAction} className="space-y-3 rounded-xl border border-edge bg-card p-4">
        <h2 className="text-sm font-semibold">Daily targets</h2>
        <p className="text-xs text-ink-faint">
          Manual override — for safety, calories can&apos;t be set below {CALORIE_FLOOR}.
        </p>
        <p className="text-[10px] text-ink-faint">
          Current mode: {targets.isManual ? "manual override" : "auto-calculated"}.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["calories", "kcal", targets.calories],
              ["proteinG", "Protein", targets.proteinG],
              ["carbsG", "Carbs", targets.carbsG],
              ["fatG", "Fat", targets.fatG],
            ] as const
          ).map(([name, label, def]) => (
            <label key={name} className="space-y-1 text-[10px] text-ink-dim">
              {label}
              <input type="number" name={name} defaultValue={def} className={inputCls} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button disabled={tPending} className={btnPrimary}>
            {tPending ? "Saving…" : "Save targets"}
          </button>
          {tState?.ok && <span className="text-xs text-accent">Saved ✓</span>}
          {tState?.error && <span className="text-xs text-danger">{tState.error}</span>}
        </div>
      </form>
    </div>
  );
}
