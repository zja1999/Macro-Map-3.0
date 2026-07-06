"use client";

import { useActionState, useMemo, useState } from "react";
import { completeOnboarding } from "@/actions/onboarding";
import { calculateTargets } from "@/lib/targets";
import { ftInToCm, lbToKg, type UnitsPref } from "@/lib/units";
import { inputCls, btnPrimary, btnGhost } from "./ui";

const GOALS = [
  { value: "fat_loss", label: "Fat loss", icon: "🔥" },
  { value: "muscle_gain", label: "Muscle gain", icon: "💪" },
  { value: "maintenance", label: "Maintenance", icon: "⚖️" },
  { value: "recomp", label: "Recomposition", icon: "🔄" },
  { value: "performance", label: "Performance", icon: "🏃" },
  { value: "general_health", label: "General health", icon: "🌱" },
] as const;

const STYLES = [
  { value: "strict_macro", label: "Strict macros", desc: "Track protein, carbs, and fat against daily targets" },
  { value: "calorie_only", label: "Calories only", desc: "One number a day, no macro breakdown" },
  { value: "protein_focused", label: "Protein-focused", desc: "Hit protein, keep calories roughly in range" },
  { value: "habit", label: "Habit-based", desc: "Build consistency without obsessing over numbers" },
  { value: "maintenance", label: "Maintenance", desc: "Keep things steady with light tracking" },
  { value: "performance", label: "Performance", desc: "Fuel training, eat around workouts" },
  { value: "no_scale", label: "No-scale mode", desc: "No weigh-ins anywhere in the app — progress by habits" },
] as const;

const ACTIVITY = [
  { value: "sedentary", label: "Sedentary", desc: "Desk job, little exercise" },
  { value: "light", label: "Lightly active", desc: "1–3 workouts/week" },
  { value: "moderate", label: "Moderately active", desc: "3–5 workouts/week" },
  { value: "very", label: "Very active", desc: "6–7 workouts/week" },
  { value: "extra", label: "Extremely active", desc: "Physical job + training" },
] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("fat_loss");
  const [style, setStyle] = useState("strict_macro");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [units, setUnits] = useState<UnitsPref>("imperial");
  // metric-mode inputs
  const [heightCmInput, setHeightCmInput] = useState(178);
  const [weightKgInput, setWeightKgInput] = useState(80);
  // imperial-mode inputs — canonical cm/kg is always derived below, never stored twice
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(10);
  const [weightLb, setWeightLb] = useState(176);
  const heightCm = units === "metric" ? heightCmInput : ftInToCm(heightFt, heightIn);
  const weightKg = units === "metric" ? weightKgInput : lbToKg(weightLb);
  const [age, setAge] = useState(25);
  const [activity, setActivity] = useState("moderate");
  const [manual, setManual] = useState(false);
  const [state, action, pending] = useActionState(completeOnboarding, undefined);

  const calc = useMemo(
    () => calculateTargets({ sex, weightKg, heightCm, age, activityLevel: activity, goal }),
    [sex, weightKg, heightCm, age, activity, goal],
  );

  const steps = ["Goal", "Tracking style", "About you", "Your targets"];

  return (
    <form action={action} className="mx-auto w-full max-w-md space-y-6">
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-edge"}`} />
        ))}
      </div>
      <h1 className="text-xl font-bold">{steps[step]}</h1>

      {/* hidden fields carry all state so the final submit posts everything */}
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="trackingStyle" value={style} />
      <input type="hidden" name="sex" value={sex} />
      <input type="hidden" name="heightCm" value={heightCm} />
      <input type="hidden" name="weightKg" value={weightKg} />
      <input type="hidden" name="units" value={units} />
      <input type="hidden" name="age" value={age} />
      <input type="hidden" name="activityLevel" value={activity} />
      {manual && <input type="hidden" name="manual" value="true" />}

      {step === 0 && (
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGoal(g.value)}
              className={`rounded-xl border p-4 text-left transition ${
                goal === g.value ? "border-accent bg-accent/10" : "border-edge bg-card hover:bg-card-hover"
              }`}
            >
              <div className="text-2xl">{g.icon}</div>
              <div className="mt-1 text-sm font-semibold">{g.label}</div>
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          {STYLES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStyle(s.value)}
              className={`block w-full rounded-xl border p-3 text-left transition ${
                style === s.value ? "border-accent bg-accent/10" : "border-edge bg-card hover:bg-card-hover"
              }`}
            >
              <div className="text-sm font-semibold">{s.label}</div>
              <div className="text-xs text-ink-faint">{s.desc}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["male", "female"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSex(s)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${
                  sex === s ? "border-accent bg-accent/10 font-semibold" : "border-edge bg-card"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["imperial", "metric"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnits(u)}
                className={`flex-1 rounded-lg border px-2 py-1 text-xs capitalize ${
                  units === u ? "border-accent bg-accent/10 font-semibold text-accent" : "border-edge bg-card text-ink-dim"
                }`}
              >
                {u === "imperial" ? "lb / ft-in" : "kg / cm"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {units === "imperial" ? (
              <>
                <label className="space-y-1 text-xs text-ink-dim">
                  Height
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={heightFt}
                      onChange={(e) => setHeightFt(+e.target.value)}
                      className={`${inputCls} w-1/2`}
                      aria-label="Feet"
                    />
                    <input
                      type="number"
                      value={heightIn}
                      onChange={(e) => setHeightIn(+e.target.value)}
                      className={`${inputCls} w-1/2`}
                      aria-label="Inches"
                    />
                  </div>
                </label>
                <label className="space-y-1 text-xs text-ink-dim">
                  Weight (lb)
                  <input type="number" value={weightLb} onChange={(e) => setWeightLb(+e.target.value)} className={inputCls} />
                </label>
              </>
            ) : (
              <>
                <label className="space-y-1 text-xs text-ink-dim">
                  Height (cm)
                  <input type="number" value={heightCmInput} onChange={(e) => setHeightCmInput(+e.target.value)} className={inputCls} />
                </label>
                <label className="space-y-1 text-xs text-ink-dim">
                  Weight (kg)
                  <input type="number" value={weightKgInput} onChange={(e) => setWeightKgInput(+e.target.value)} className={inputCls} />
                </label>
              </>
            )}
            <label className="space-y-1 text-xs text-ink-dim">
              Age
              <input type="number" value={age} onChange={(e) => setAge(+e.target.value)} className={inputCls} />
            </label>
          </div>
          <div className="space-y-2">
            {ACTIVITY.map((a) => (
              <button
                key={a.value}
                type="button"
                onClick={() => setActivity(a.value)}
                className={`block w-full rounded-xl border p-3 text-left transition ${
                  activity === a.value ? "border-accent bg-accent/10" : "border-edge bg-card hover:bg-card-hover"
                }`}
              >
                <span className="text-sm font-semibold">{a.label}</span>
                <span className="ml-2 text-xs text-ink-faint">{a.desc}</span>
              </button>
            ))}
          </div>
          <label className="block space-y-1 text-xs text-ink-dim">
            Dietary style (optional)
            <input name="dietaryStyle" placeholder="e.g. vegetarian, halal, none" className={inputCls} />
          </label>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
            <div className="text-3xl font-bold text-accent">{calc.calories}</div>
            <div className="text-xs uppercase tracking-wide text-ink-faint">calories / day</div>
            <div className="mt-3 flex justify-center gap-4 text-sm">
              <span className="text-protein">{calc.proteinG}g protein</span>
              <span className="text-carbs">{calc.carbsG}g carbs</span>
              <span className="text-fat">{calc.fatG}g fat</span>
            </div>
          </div>
          <button type="button" onClick={() => setManual(!manual)} className="text-xs text-ink-dim underline">
            {manual ? "Use calculated targets instead" : "I'm advanced — set my own targets"}
          </button>
          {manual && (
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  ["calories", "kcal", calc.calories],
                  ["proteinG", "P (g)", calc.proteinG],
                  ["carbsG", "C (g)", calc.carbsG],
                  ["fatG", "F (g)", calc.fatG],
                ] as const
              ).map(([name, label, def]) => (
                <label key={name} className="space-y-1 text-[10px] text-ink-dim">
                  {label}
                  <input type="number" name={name} defaultValue={def} className={inputCls} />
                </label>
              ))}
            </div>
          )}
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        </div>
      )}

      <div className="flex justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(step - 1)} className={btnGhost}>
            Back
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button type="button" onClick={() => setStep(step + 1)} className={btnPrimary}>
            Continue
          </button>
        ) : (
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "Setting up…" : "Start tracking"}
          </button>
        )}
      </div>
    </form>
  );
}
