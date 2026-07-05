"use client";

import { useActionState, useState } from "react";
import { createChallenge } from "@/actions/groups";
import { inputCls, btnPrimary, btnGhost } from "@/components/ui";

const METRICS = [
  { key: "logged_days", label: "Days with food logged", unit: "days" },
  { key: "protein_days", label: "Days protein goal hit", unit: "days" },
  { key: "workouts", label: "Workouts completed", unit: "sessions" },
  { key: "custom_checkin", label: "Daily check-in (self-reported)", unit: "check-ins" },
];

export function ChallengeCreateForm({
  today,
  defaultEnd,
  groups,
}: {
  today: string;
  defaultEnd: string;
  groups: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createChallenge, undefined);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnGhost}>
        + Create challenge
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2 rounded-xl border border-edge bg-card p-3">
      <input name="title" required minLength={3} maxLength={80} placeholder="Challenge title (e.g. Protein-Perfect February)" className={inputCls} autoFocus />
      <input name="description" maxLength={300} placeholder="One line on the why (optional)" className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[10px] text-ink-dim">
          Metric (behavior-based — auto-scored from your logs)
          <select name="metric" className={inputCls}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Target
          <input type="number" name="target" required min={1} max={1000} defaultValue={20} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Starts
          <input type="date" name="startsOn" required defaultValue={today} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Ends
          <input type="date" name="endsOn" required defaultValue={defaultEnd} className={inputCls} />
        </label>
      </div>
      {groups.length > 0 && (
        <label className="block space-y-1 text-[10px] text-ink-dim">
          Group (optional — global if empty)
          <select name="groupId" className={inputCls} defaultValue="">
            <option value="">🌍 Global — anyone can join</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Creating…" : "Create"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
