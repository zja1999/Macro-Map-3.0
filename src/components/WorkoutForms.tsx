"use client";

import { useActionState, useMemo, useState } from "react";
import { createWorkout, logWorkout } from "@/actions/workouts";
import { lbToKg, type UnitsPref } from "@/lib/units";
import { inputCls, btnPrimary, btnGhost } from "./ui";

export type ExerciseOption = { id: string; name: string; isBodyweight: boolean };

// ─── create / fork a shareable workout ───────────────────────────────────────

type StructureRow = { exerciseName: string; sets: string; reps: string; notes: string };

export function WorkoutForm({
  exerciseOptions,
  fork,
}: {
  exerciseOptions: ExerciseOption[];
  fork?: { forkedFromId: string; title: string; rows: StructureRow[] };
}) {
  const [rows, setRows] = useState<StructureRow[]>(
    fork?.rows ?? [{ exerciseName: "", sets: "3", reps: "8-12", notes: "" }],
  );
  const [state, action, pending] = useActionState(createWorkout, undefined);
  const byName = useMemo(() => new Map(exerciseOptions.map((e) => [e.name.toLowerCase(), e])), [exerciseOptions]);

  const structure = rows
    .map((r) => {
      const ex = byName.get(r.exerciseName.trim().toLowerCase());
      return ex
        ? { exerciseId: ex.id, sets: parseInt(r.sets) || 3, reps: r.reps || "8-12", notes: r.notes || undefined }
        : null;
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
        placeholder="Workout name (e.g. Push Day A)"
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
          Difficulty 1–5
          <input type="number" name="difficulty" min={1} max={5} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Duration (min)
          <input type="number" name="estDurationMin" min={5} max={300} className={inputCls} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-dim">Exercises</h2>
          <span className="text-[11px] text-ink-faint">{structure.length} matched</span>
        </div>
        <datalist id="exercise-options">
          {exerciseOptions.map((e) => (
            <option key={e.id} value={e.name} />
          ))}
        </datalist>
        {rows.map((row, i) => {
          const matched = byName.has(row.exerciseName.trim().toLowerCase());
          return (
            <div key={i} className="flex items-center gap-2">
              <input
                list="exercise-options"
                value={row.exerciseName}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, exerciseName: e.target.value } : x)))}
                placeholder="Exercise"
                className={inputCls}
              />
              <input
                type="number"
                value={row.sets}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, sets: e.target.value } : x)))}
                min={1}
                max={20}
                className={`${inputCls} w-16 text-center`}
                aria-label="Sets"
              />
              <input
                value={row.reps}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))}
                placeholder="reps"
                maxLength={20}
                className={`${inputCls} w-20 text-center`}
                aria-label="Reps"
              />
              <span className={`w-4 text-center text-sm ${matched ? "text-accent" : "text-ink-faint"}`}>
                {matched ? "✓" : "–"}
              </span>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-ink-faint hover:text-danger"
                aria-label="Remove exercise"
              >
                ✕
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setRows([...rows, { exerciseName: "", sets: "3", reps: "8-12", notes: "" }])}
          className={btnGhost}
        >
          + Add exercise
        </button>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || structure.length === 0} className={`${btnPrimary} w-full`}>
        {pending ? "Publishing…" : fork ? "Publish fork" : "Publish workout"}
      </button>
    </form>
  );
}

// ─── session logger with PR detection on submit ─────────────────────────────

type LoggerSet = { reps: string; weightKg: string };
type LoggerRow = { exerciseName: string; sets: LoggerSet[] };

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
  const [rows, setRows] = useState<LoggerRow[]>(
    prefill?.length ? prefill : [{ exerciseName: "", sets: [{ reps: "", weightKg: "" }] }],
  );
  const [state, action, pending] = useActionState(logWorkout, undefined);
  const byName = useMemo(() => new Map(exerciseOptions.map((e) => [e.name.toLowerCase(), e])), [exerciseOptions]);
  const weightUnit = units === "imperial" ? "lb" : "kg";

  const entries = rows
    .map((r) => {
      const ex = byName.get(r.exerciseName.trim().toLowerCase());
      if (!ex) return null;
      const sets = r.sets
        .map((s) => {
          const raw = s.weightKg === "" ? null : parseFloat(s.weightKg) || 0;
          // field is always labeled/entered in the user's unit — convert to
          // canonical kg here, once, before it reaches the server action
          const weightKg = raw == null ? null : units === "imperial" ? lbToKg(raw) : raw;
          return { reps: parseInt(s.reps) || 0, weightKg };
        })
        .filter((s) => s.reps > 0);
      return sets.length ? { exerciseId: ex.id, sets } : null;
    })
    .filter(Boolean);

  const update = (i: number, fn: (r: LoggerRow) => LoggerRow) => setRows(rows.map((x, j) => (j === i ? fn(x) : x)));

  return (
    <form action={action} className="space-y-4">
      {workoutId && <input type="hidden" name="workoutId" value={workoutId} />}
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <datalist id="exercise-options">
        {exerciseOptions.map((e) => (
          <option key={e.id} value={e.name} />
        ))}
      </datalist>

      {rows.map((row, i) => {
        const ex = byName.get(row.exerciseName.trim().toLowerCase());
        return (
          <div key={i} className="rounded-xl border border-edge bg-card p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                list="exercise-options"
                value={row.exerciseName}
                onChange={(e) => update(i, (r) => ({ ...r, exerciseName: e.target.value }))}
                placeholder="Exercise"
                className={inputCls}
              />
              <span className={`w-4 text-center text-sm ${ex ? "text-accent" : "text-ink-faint"}`}>{ex ? "✓" : "–"}</span>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-ink-faint hover:text-danger"
                aria-label="Remove exercise"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              {row.sets.map((s, si) => (
                <div key={si} className="flex items-center gap-2 text-xs">
                  <span className="w-10 text-ink-faint">Set {si + 1}</span>
                  <input
                    type="number"
                    value={s.weightKg}
                    onChange={(e) =>
                      update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, weightKg: e.target.value } : x)) }))
                    }
                    placeholder={ex?.isBodyweight ? "BW" : weightUnit}
                    step="0.5"
                    min={0}
                    className={`${inputCls} w-24 py-1.5 text-center`}
                    aria-label={`Weight (${weightUnit})`}
                  />
                  <span className="text-ink-faint">×</span>
                  <input
                    type="number"
                    value={s.reps}
                    onChange={(e) =>
                      update(i, (r) => ({ ...r, sets: r.sets.map((x, k) => (k === si ? { ...x, reps: e.target.value } : x)) }))
                    }
                    placeholder="reps"
                    min={1}
                    className={`${inputCls} w-20 py-1.5 text-center`}
                    aria-label="Reps"
                  />
                  <button
                    type="button"
                    onClick={() => update(i, (r) => ({ ...r, sets: r.sets.filter((_, k) => k !== si) }))}
                    className="text-ink-faint hover:text-danger"
                    aria-label="Remove set"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update(i, (r) => ({ ...r, sets: [...r.sets, r.sets[r.sets.length - 1] ?? { reps: "", weightKg: "" }] }))
                }
                className="text-[11px] font-medium text-accent hover:underline"
              >
                + Add set
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setRows([...rows, { exerciseName: "", sets: [{ reps: "", weightKg: "" }] }])}
        className={btnGhost}
      >
        + Add exercise
      </button>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[10px] text-ink-dim">
          Duration (min)
          <input type="number" name="durationMin" min={1} max={600} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Notes
          <input name="notes" maxLength={500} placeholder="Felt strong today…" className={inputCls} />
        </label>
      </div>

      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || entries.length === 0} className={`${btnPrimary} w-full`}>
        {pending ? "Saving…" : "Finish session (checks for PRs)"}
      </button>
    </form>
  );
}
