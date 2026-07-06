"use client";

import { useActionState, useState } from "react";
import { createGroup } from "@/actions/groups";
import { inputCls, btnPrimary, btnGhost } from "@/components/ui";

export function GroupCreateForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createGroup, undefined);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btnGhost}>
        + Start a group
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-xl border border-edge bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
        <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          Group name
          <input name="name" required minLength={3} maxLength={60} placeholder="Weekend meal preppers" className={inputCls} autoFocus />
        </label>
        <label className="space-y-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
          Group type
          <select name="kind" defaultValue="goal" className={inputCls}>
            {[
              ["goal", "Goal"],
              ["diet", "Diet"],
              ["location", "Location"],
              ["gym", "Gym"],
              ["interest", "Interest"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
        Description
        <input name="description" maxLength={300} placeholder="What is this group about?" className={inputCls} />
      </label>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Creating…" : "Create group"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Cancel
        </button>
      </div>
    </form>
  );
}
