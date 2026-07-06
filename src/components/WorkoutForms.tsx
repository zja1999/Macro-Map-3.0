"use client";

import { useActionState, useMemo, useState } from "react";
import { createWorkout, logWorkout } from "@/actions/workouts";
import { lbToKg, type UnitsPref } from "@/lib/units";
import { inputCls, btnPrimary, btnGhost } from "./ui";

type ActivityType =
  | "strength"
  | "outdoor_run"
  | "treadmill_run"
  | "rowing"
  | "stationary_bike"
  | "outdoor_bike"
  | "walk"
  | "hike"
  | "elliptical"
  | "mobility"
  | "generic_cardio";

export type ExerciseOption = {
  id: string;
  name: string;
  isBodyweight: boolean;
  isCardio?: boolean;
  activityType: ActivityType;
};

const ACTIVITY_CARDS: { type: ActivityType; title: string; hint: string }[] = [
  { type: "strength", title: "Strength", hint: "Sets, reps, weight, RPE" },
  { type: "outdoor_run", title: "Outdoor run", hint: "Distance, time, route note" },
  { type: "treadmill_run", title: "Treadmill run", hint: "Distance, time, speed, incline" },
  { type: "rowing", title: "Rowing machine", hint: "Meters, split, stroke rate" },
  { type: "stationary_bike", title: "Stationary bike", hint: "Time, distance, resistance" },
  { type: "outdoor_bike", title: "Outdoor bike", hint: "Distance, time, speed" },
  { type: "walk", title: "Walk", hint: "Distance, time, route note" },
  { type: "hike", title: "Hike", hint: "Distance, time, effort" },
  { type: "elliptical", title: "Elliptical", hint: "Time, resistance, calories" },
  { type: "mobility", title: "Mobility", hint: "Duration, focus area" },
  { type: "generic_cardio", title: "Cardio", hint: "Flexible time-based session" },
];

const ACTIVITY_TITLES = new Map(ACTIVITY_CARDS.map((a) => [a.type, a.title]));
const emptySet = () => ({ reps: "", weight: "", rpe: "", restSec: "", holdSec: "" });
const toNum = (value: string) => (value.trim() === "" ? null : Number(value));
const toMeters = (value: number | null, units: UnitsPref, activityType: ActivityType) => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  if (activityType === "rowing") return value;
  return units === "imperial" ? value * 1609.344 : value * 1000;
};
const toKph = (value: number | null, units: UnitsPref) => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return units === "imperial" ? value * 1.609344 : value;
};

// ─── create / fork a shareable workout ───────────────────────────────────────

type StructureRow = {
  exerciseName: string;
  sets: string;
  reps: string;
  durationMin: string;
  distance: string;
  notes: string;
};

export function WorkoutForm({
  exerciseOptions,
  fork,
}: {
  exerciseOptions: ExerciseOption[];
  fork?: { forkedFromId: string; title: string; rows: StructureRow[] };
}) {
  const [rows, setRows] = useState<StructureRow[]>(
    fork?.rows ?? [{ exerciseName: "", sets: "3", reps: "8-12", durationMin: "", distance: "", notes: "" }],
  );
  const [state, action, pending] = useActionState(createWorkout, undefined);
  const byName = useMemo(() => new Map(exerciseOptions.map((e) => [e.name.toLowerCase(), e])), [exerciseOptions]);

  const structure = rows
    .map((r) => {
      const ex = byName.get(r.exerciseName.trim().toLowerCase());
      if (!ex) return null;
      const activityType = ex.activityType;
      if (activityType !== "strength") {
        const targetDurationMin = toNum(r.durationMin);
        const targetDistanceM = toMeters(toNum(r.distance), "imperial", activityType);
        return {
          exerciseId: ex.id,
          kind: activityType === "mobility" ? "mobility" : "cardio",
          activityType,
          targetDurationMin: targetDurationMin ?? undefined,
          targetDistanceM: targetDistanceM ?? undefined,
          notes: r.notes || undefined,
        };
      }
      return {
        exerciseId: ex.id,
        kind: "strength",
        activityType: "strength",
        sets: parseInt(r.sets) || 3,
        reps: r.reps || "8-12",
        notes: r.notes || undefined,
      };
    })
    .filter(Boolean);

  return (
    <form action={action} className="space-y-4">
      {fork && <input type="hidden" name="forkedFromId" value={fork.forkedFromId} />}
      <input type="hidden" name="structure" value={JSON.stringify(structure)} />

      <input
        name="title"
        required
        minLength={3}
        maxLength={80}
        defaultValue={fork ? `${fork.title} (my version)` : ""}
        placeholder="Workout name (e.g. Push Day A, 5K Run/Walk)"
        className={inputCls}
      />
      <textarea name="description" maxLength={500} rows={2} placeholder="What's the idea? (optional)" className={`${inputCls} resize-none`} />
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 text-[10px] text-ink-dim">
          Type
          <select name="kind" className={inputCls}>
            {["strength", "cardio", "mobility", "mixed"].map((k) => (
              <option key={k} value={k} className="capitalize">
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Difficulty 1-5
          <input type="number" name="difficulty" min={1} max={5} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Duration (min)
          <input type="number" name="estDurationMin" min={5} max={300} className={inputCls} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-dim">Plan</h2>
          <span className="text-[11px] text-ink-faint">{structure.length} matched</span>
        </div>
        <ExerciseDatalist exerciseOptions={exerciseOptions} />
        {rows.map((row, i) => {
          const ex = byName.get(row.exerciseName.trim().toLowerCase());
          const matched = Boolean(ex);
          const isStrength = !ex || ex.activityType === "strength";
          return (
            <div key={i} className="rounded-lg border border-edge bg-card p-2">
              <div className="flex items-center gap-2">
                <input
                  list="exercise-options"
                  value={row.exerciseName}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, exerciseName: e.target.value } : x)))}
                  placeholder="Exercise or activity"
                  className={inputCls}
                />
                <span className={`w-4 text-center text-sm ${matched ? "text-accent" : "text-ink-faint"}`}>{matched ? "✓" : "-"}</span>
                <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-ink-faint hover:text-danger" aria-label="Remove exercise">
                  ×
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {isStrength ? (
                  <>
                    <input type="number" value={row.sets} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, sets: e.target.value } : x)))} min={1} max={20} placeholder="sets" className={`${inputCls} text-center`} />
                    <input value={row.reps} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} placeholder="reps" maxLength={20} className={`${inputCls} text-center`} />
                  </>
                ) : (
                  <>
                    <input type="number" value={row.durationMin} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, durationMin: e.target.value } : x)))} min={1} placeholder="min" className={`${inputCls} text-center`} />
                    <input type="number" value={row.distance} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, distance: e.target.value } : x)))} min={0} step="0.01" placeholder={ex?.activityType === "rowing" ? "meters" : "miles"} className={`${inputCls} text-center`} />
                  </>
                )}
                <input value={row.notes} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} placeholder="notes" maxLength={120} className={inputCls} />
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setRows([...rows, { exerciseName: "", sets: "3", reps: "8-12", durationMin: "", distance: "", notes: "" }])} className={btnGhost}>
          + Add movement
        </button>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || structure.length === 0} className={`${btnPrimary} w-full`}>
        {pending ? "Publishing..." : fork ? "Publish fork" : "Publish workout"}
      </button>
    </form>
  );
}

function ExerciseDatalist({ exerciseOptions }: { exerciseOptions: ExerciseOption[] }) {
  return (
    <datalist id="exercise-options">
      {exerciseOptions.map((e) => (
        <option key={e.id} value={e.name} />
      ))}
    </datalist>
  );
}

// ─── session logger launcher ────────────────────────────────────────────────

type LoggerSet = { reps: string; weight: string; rpe: string; restSec: string; holdSec: string };
// isHold rows log a timed isometric hold (e.g. a plank) — seconds per set, no weight/reps
type LoggerRow = { exerciseName: string; sets: LoggerSet[]; isHold?: boolean };

export function WorkoutLogger({
  exerciseOptions,
  workoutId,
  prefill,
  units,
}: {
  exerciseOptions: ExerciseOption[];
  workoutId?: string;
  prefill?: LoggerRow[];
  units: UnitsPref;
}) {
  const [activityType, setActivityType] = useState<ActivityType>(prefill?.length ? "strength" : "strength");
  const hasPrefill = Boolean(prefill?.length);
  return (
    <div className="space-y-4">
      {!hasPrefill && <WorkoutTypePicker value={activityType} onChange={setActivityType} />}
      {activityType === "strength" && <StrengthLogger exerciseOptions={exerciseOptions} workoutId={workoutId} prefill={prefill} units={units} />}
      {activityType === "outdoor_run" && <RunLogger exerciseOptions={exerciseOptions} activityType="outdoor_run" units={units} workoutId={workoutId} />}
      {activityType === "treadmill_run" && <TreadmillLogger exerciseOptions={exerciseOptions} units={units} workoutId={workoutId} />}
      {activityType === "rowing" && <RowingLogger exerciseOptions={exerciseOptions} workoutId={workoutId} />}
      {(activityType === "stationary_bike" || activityType === "outdoor_bike") && <BikeLogger exerciseOptions={exerciseOptions} activityType={activityType} units={units} workoutId={workoutId} />}
      {(activityType === "walk" || activityType === "hike") && <RunLogger exerciseOptions={exerciseOptions} activityType={activityType} units={units} workoutId={workoutId} />}
      {activityType === "elliptical" && <BikeLogger exerciseOptions={exerciseOptions} activityType="elliptical" units={units} workoutId={workoutId} />}
      {activityType === "mobility" && <MobilityLogger exerciseOptions={exerciseOptions} workoutId={workoutId} />}
      {activityType === "generic_cardio" && <BikeLogger exerciseOptions={exerciseOptions} activityType="generic_cardio" units={units} workoutId={workoutId} />}
    </div>
  );
}

export function WorkoutTypePicker({ value, onChange }: { value: ActivityType; onChange: (value: ActivityType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ACTIVITY_CARDS.map((card) => (
        <button
          key={card.type}
          type="button"
          onClick={() => onChange(card.type)}
          className={`rounded-lg border p-3 text-left transition ${
            value === card.type ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:border-accent/60"
          }`}
        >
          <div className="text-sm font-semibold">{card.title}</div>
          <div className="mt-1 text-[11px] text-ink-faint">{card.hint}</div>
        </button>
      ))}
    </div>
  );
}

// ─── strength logger ────────────────────────────────────────────────────────

export function StrengthLogger({
  exerciseOptions,
  workoutId,
  prefill,
  units,
}: {
  exerciseOptions: ExerciseOption[];
  workoutId?: string;
  prefill?: LoggerRow[];
  units: UnitsPref;
}) {
  const [rows, setRows] = useState<LoggerRow[]>(prefill?.length ? prefill : [{ exerciseName: "", sets: [emptySet()] }]);
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const strengthOptions = exerciseOptions.filter((e) => e.activityType === "strength");
  const byName = useMemo(() => new Map(strengthOptions.map((e) => [e.name.toLowerCase(), e])), [strengthOptions]);
  const weightUnit = units === "imperial" ? "lb" : "kg";

  const entries = rows
    .map((r) => {
      const ex = byName.get(r.exerciseName.trim().toLowerCase());
      if (!ex) return null;
      const sets = r.sets
        .map((s) => {
          const repsValue = s.reps.trim() === "" ? 0 : Number(s.reps);
          const rawWeight = toNum(s.weight);
          const weightKg = rawWeight == null ? null : units === "imperial" ? lbToKg(rawWeight) : rawWeight;
          const rpe = toNum(s.rpe);
          const restSec = toNum(s.restSec);
          const holdSec = r.isHold ? toNum(s.holdSec) : null;
          return {
            reps: r.isHold ? 0 : Number.isInteger(repsValue) ? repsValue : 0,
            weightKg: r.isHold ? null : weightKg,
            rpe: rpe == null ? null : rpe,
            restSec: restSec == null ? null : restSec,
            holdSec: holdSec == null ? null : Math.round(holdSec),
          };
        })
        .filter((s) => (s.holdSec ?? 0) > 0 || s.reps > 0);
      return sets.length ? { kind: "strength", activityType: "strength", exerciseId: ex.id, sets } : null;
    })
    .filter(Boolean);
  const repsError = rows.some((r) => !r.isHold && r.sets.some((s) => s.reps.trim() !== "" && !Number.isInteger(Number(s.reps)))) ? "Reps must be whole numbers. Add partial reps in notes." : null;
  const update = (i: number, fn: (r: LoggerRow) => LoggerRow) => setRows(rows.map((x, j) => (j === i ? fn(x) : x)));

  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />
      <ExerciseDatalist exerciseOptions={strengthOptions} />

      {rows.map((row, i) => {
        const ex = byName.get(row.exerciseName.trim().toLowerCase());
        return (
          <div key={i} className="rounded-xl border border-edge bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <input list="exercise-options" value={row.exerciseName} onChange={(e) => update(i, (r) => ({ ...r, exerciseName: e.target.value }))} placeholder="Strength exercise" className={inputCls} />
              <span className={`w-4 text-center text-sm ${ex ? "text-accent" : "text-ink-faint"}`}>{ex ? "✓" : "-"}</span>
              <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-ink-faint hover:text-danger" aria-label="Remove exercise">
                ×
              </button>
            </div>
            <div className="space-y-1.5">
              {row.sets.map((s, si) => (
                <div key={si} className="grid grid-cols-[42px_1fr_1fr_0.8fr_0.8fr_24px] items-center gap-2 text-xs">
                  <span className="text-ink-faint">Set {si + 1}</span>
                  {row.isHold ? (
                    <input type="number" value={s.holdSec} onChange={(e) => update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, holdSec: e.target.value } : x)) }))} placeholder="hold s" min={1} step={1} className={`${inputCls} col-span-2 py-1.5 text-center`} aria-label="Hold seconds" />
                  ) : (
                    <>
                      <input type="number" value={s.weight} onChange={(e) => update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, weight: e.target.value } : x)) }))} placeholder={ex?.isBodyweight ? "BW" : weightUnit} step="0.5" min={0} className={`${inputCls} py-1.5 text-center`} aria-label={`Weight (${weightUnit})`} />
                      <input type="number" value={s.reps} onChange={(e) => update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, reps: e.target.value } : x)) }))} placeholder="reps" min={1} step={1} className={`${inputCls} py-1.5 text-center`} aria-label="Reps" />
                    </>
                  )}
                  <input type="number" value={s.rpe} onChange={(e) => update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, rpe: e.target.value } : x)) }))} placeholder="RPE" min={1} max={10} step="0.5" className={`${inputCls} py-1.5 text-center`} aria-label="RPE" />
                  <input type="number" value={s.restSec} onChange={(e) => update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, restSec: e.target.value } : x)) }))} placeholder="rest s" min={0} step={1} className={`${inputCls} py-1.5 text-center`} aria-label="Rest seconds" />
                  <button type="button" onClick={() => update(i, (r) => ({ ...r, sets: r.sets.filter((_, k) => k !== si) }))} className="text-ink-faint hover:text-danger" aria-label="Remove set">
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => update(i, (r) => ({ ...r, sets: [...r.sets, { ...(r.sets[r.sets.length - 1] ?? emptySet()) }] }))} className="text-[11px] font-medium text-accent hover:underline">
                + Add set
              </button>
            </div>
          </div>
        );
      })}

      <button type="button" onClick={() => setRows([...rows, { exerciseName: "", sets: [emptySet()] }])} className={btnGhost}>
        + Add exercise
      </button>
      <SessionFooter pending={pending} stateError={state?.error} localError={repsError} disabled={entries.length === 0 || Boolean(repsError)} />
    </form>
  );
}

// ─── cardio and mobility loggers ────────────────────────────────────────────

function useActivityExercise(exerciseOptions: ExerciseOption[], activityType: ActivityType) {
  return exerciseOptions.find((e) => e.activityType === activityType) ?? null;
}

export function RunLogger({ exerciseOptions, activityType, units, workoutId }: { exerciseOptions: ExerciseOption[]; activityType: "outdoor_run" | "walk" | "hike"; units: UnitsPref; workoutId?: string }) {
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const exercise = useActivityExercise(exerciseOptions, activityType);
  const [durationMin, setDurationMin] = useState("");
  const [distance, setDistance] = useState("");
  const [effort, setEffort] = useState("");
  const [routeNote, setRouteNote] = useState("");
  const [notes, setNotes] = useState("");
  const distanceM = toMeters(toNum(distance), units, activityType);
  const entry = exercise && toNum(durationMin)
    ? { kind: "cardio", activityType, exerciseId: exercise.id, durationMin: toNum(durationMin), distanceM, perceivedEffort: toNum(effort), routeNote: routeNote || null, notes: notes || null }
    : null;
  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entry ? [entry] : [])} />
      <CardioFields title={ACTIVITY_TITLES.get(activityType) ?? "Run"} exercise={exercise} units={units} distanceLabel={`Distance (${units === "imperial" ? "mi" : "km"})`} durationMin={durationMin} setDurationMin={setDurationMin} distance={distance} setDistance={setDistance} effort={effort} setEffort={setEffort} notes={notes} setNotes={setNotes}>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Route / location note
          <input value={routeNote} onChange={(e) => setRouteNote(e.target.value)} maxLength={160} placeholder="Neighborhood loop, trail, track..." className={inputCls} />
        </label>
      </CardioFields>
      <SessionFooter pending={pending} stateError={state?.error} disabled={!entry} />
    </form>
  );
}

export function TreadmillLogger({ exerciseOptions, units, workoutId }: { exerciseOptions: ExerciseOption[]; units: UnitsPref; workoutId?: string }) {
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const exercise = useActivityExercise(exerciseOptions, "treadmill_run");
  const [durationMin, setDurationMin] = useState("");
  const [distance, setDistance] = useState("");
  const [speed, setSpeed] = useState("");
  const [incline, setIncline] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const entry = exercise && toNum(durationMin)
    ? { kind: "cardio", activityType: "treadmill_run", exerciseId: exercise.id, durationMin: toNum(durationMin), distanceM: toMeters(toNum(distance), units, "treadmill_run"), speedKph: toKph(toNum(speed), units), inclinePct: toNum(incline), perceivedEffort: toNum(effort), notes: notes || null }
    : null;
  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entry ? [entry] : [])} />
      <CardioFields title="Treadmill run" exercise={exercise} units={units} distanceLabel={`Distance (${units === "imperial" ? "mi" : "km"})`} durationMin={durationMin} setDurationMin={setDurationMin} distance={distance} setDistance={setDistance} effort={effort} setEffort={setEffort} notes={notes} setNotes={setNotes}>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Avg speed ({units === "imperial" ? "mph" : "km/h"})
          <input type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} min={0} step="0.1" className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Incline %
          <input type="number" value={incline} onChange={(e) => setIncline(e.target.value)} min={0} step="0.5" className={inputCls} />
        </label>
      </CardioFields>
      <SessionFooter pending={pending} stateError={state?.error} disabled={!entry} />
    </form>
  );
}

export function RowingLogger({ exerciseOptions, workoutId }: { exerciseOptions: ExerciseOption[]; workoutId?: string }) {
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const exercise = useActivityExercise(exerciseOptions, "rowing");
  const [durationMin, setDurationMin] = useState("");
  const [distance, setDistance] = useState("");
  const [strokeRate, setStrokeRate] = useState("");
  const [resistance, setResistance] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const entry = exercise && toNum(durationMin)
    ? { kind: "cardio", activityType: "rowing", exerciseId: exercise.id, durationMin: toNum(durationMin), distanceM: toMeters(toNum(distance), "metric", "rowing"), strokeRate: toNum(strokeRate), resistance: toNum(resistance), perceivedEffort: toNum(effort), notes: notes || null }
    : null;
  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entry ? [entry] : [])} />
      <CardioFields title="Rowing machine" exercise={exercise} units="metric" distanceLabel="Distance (m)" durationMin={durationMin} setDurationMin={setDurationMin} distance={distance} setDistance={setDistance} effort={effort} setEffort={setEffort} notes={notes} setNotes={setNotes}>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Stroke rate (spm)
          <input type="number" value={strokeRate} onChange={(e) => setStrokeRate(e.target.value)} min={0} step={1} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Damper / resistance
          <input type="number" value={resistance} onChange={(e) => setResistance(e.target.value)} min={0} step={1} className={inputCls} />
        </label>
      </CardioFields>
      <SessionFooter pending={pending} stateError={state?.error} disabled={!entry} />
    </form>
  );
}

export function BikeLogger({ exerciseOptions, activityType, units, workoutId }: { exerciseOptions: ExerciseOption[]; activityType: "stationary_bike" | "outdoor_bike" | "elliptical" | "generic_cardio"; units: UnitsPref; workoutId?: string }) {
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const exercise = useActivityExercise(exerciseOptions, activityType);
  const [durationMin, setDurationMin] = useState("");
  const [distance, setDistance] = useState("");
  const [speed, setSpeed] = useState("");
  const [resistance, setResistance] = useState("");
  const [powerWatts, setPowerWatts] = useState("");
  const [calories, setCalories] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const entry = exercise && toNum(durationMin)
    ? { kind: "cardio", activityType, exerciseId: exercise.id, durationMin: toNum(durationMin), distanceM: toMeters(toNum(distance), units, activityType), speedKph: toKph(toNum(speed), units), resistance: toNum(resistance), powerWatts: toNum(powerWatts), calories: toNum(calories), perceivedEffort: toNum(effort), notes: notes || null }
    : null;
  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entry ? [entry] : [])} />
      <CardioFields title={ACTIVITY_TITLES.get(activityType) ?? "Cardio"} exercise={exercise} units={units} distanceLabel={`Distance (${units === "imperial" ? "mi" : "km"})`} durationMin={durationMin} setDurationMin={setDurationMin} distance={distance} setDistance={setDistance} effort={effort} setEffort={setEffort} notes={notes} setNotes={setNotes}>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Avg speed ({units === "imperial" ? "mph" : "km/h"})
          <input type="number" value={speed} onChange={(e) => setSpeed(e.target.value)} min={0} step="0.1" className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Resistance
          <input type="number" value={resistance} onChange={(e) => setResistance(e.target.value)} min={0} step={1} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Power (watts)
          <input type="number" value={powerWatts} onChange={(e) => setPowerWatts(e.target.value)} min={0} step={1} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Calories
          <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} min={0} step={1} className={inputCls} />
        </label>
      </CardioFields>
      <SessionFooter pending={pending} stateError={state?.error} disabled={!entry} />
    </form>
  );
}

export function MobilityLogger({ exerciseOptions, workoutId }: { exerciseOptions: ExerciseOption[]; workoutId?: string }) {
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const exercise = useActivityExercise(exerciseOptions, "mobility");
  const [durationMin, setDurationMin] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [effort, setEffort] = useState("");
  const [notes, setNotes] = useState("");
  const entry = exercise && toNum(durationMin)
    ? { kind: "mobility", activityType: "mobility", exerciseId: exercise.id, durationMin: toNum(durationMin), focusArea: focusArea || null, perceivedEffort: toNum(effort), notes: notes || null }
    : null;
  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entry ? [entry] : [])} />
      <div className="rounded-xl border border-edge bg-card p-3">
        <h2 className="mb-3 text-sm font-semibold">{exercise?.name ?? "Mobility"}</h2>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-[10px] text-ink-dim">
            Duration (min)
            <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} min={1} step="0.5" required className={inputCls} />
          </label>
          <label className="space-y-1 text-[10px] text-ink-dim">
            Effort 1-10
            <input type="number" value={effort} onChange={(e) => setEffort(e.target.value)} min={1} max={10} step={1} className={inputCls} />
          </label>
          <label className="col-span-2 space-y-1 text-[10px] text-ink-dim">
            Focus area
            <input value={focusArea} onChange={(e) => setFocusArea(e.target.value)} maxLength={80} placeholder="Hips, shoulders, full body..." className={inputCls} />
          </label>
          <label className="col-span-2 space-y-1 text-[10px] text-ink-dim">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className={inputCls} />
          </label>
        </div>
      </div>
      <SessionFooter pending={pending} stateError={state?.error} disabled={!entry} />
    </form>
  );
}

function CardioFields({
  title,
  exercise,
  units,
  distanceLabel,
  durationMin,
  setDurationMin,
  distance,
  setDistance,
  effort,
  setEffort,
  notes,
  setNotes,
  children,
}: {
  title: string;
  exercise: ExerciseOption | null;
  units: UnitsPref;
  distanceLabel: string;
  durationMin: string;
  setDurationMin: (value: string) => void;
  distance: string;
  setDistance: (value: string) => void;
  effort: string;
  setEffort: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-edge bg-card p-3">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{exercise?.name ?? title}</h2>
        <p className="text-[11px] text-ink-faint">{units === "imperial" ? "Using miles/mph where applicable." : "Using km/km/h where applicable."}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[10px] text-ink-dim">
          Duration (min)
          <input type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} min={0.5} step="0.5" required className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          {distanceLabel}
          <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} min={0} step="0.01" className={inputCls} />
        </label>
        {children}
        <label className="space-y-1 text-[10px] text-ink-dim">
          Effort 1-10
          <input type="number" value={effort} onChange={(e) => setEffort(e.target.value)} min={1} max={10} step={1} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Notes
          <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="How it felt..." className={inputCls} />
        </label>
      </div>
    </div>
  );
}

function SessionFooter({
  pending,
  stateError,
  localError,
  disabled,
}: {
  pending: boolean;
  stateError?: string;
  localError?: string | null;
  disabled: boolean;
}) {
  return (
    <>
      {(localError || stateError) && <p className="text-sm text-danger">{localError ?? stateError}</p>}
      <button disabled={pending || disabled} className={`${btnPrimary} w-full`}>
        {pending ? "Saving..." : "Finish session"}
      </button>
    </>
  );
}
