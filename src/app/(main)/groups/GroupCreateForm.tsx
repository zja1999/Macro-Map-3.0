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
    <form action={action} className="space-y-2 rounded-xl border border-edge bg-card p-3">
      <div className="flex gap-2">
        <input name="name" required minLength={3} maxLength={60} placeholder="Group name" className={inputCls} autoFocus />
        <select name="kind" className={`${inputCls} w-auto`}>
          {["goal", "diet", "location", "gym", "interest"].map((k) => (
            <option key={k} value={k} className="capitalize">
              {k}
            </option>
          ))}
        </select>
      </div>
      <input name="description" maxLength={300} placeholder="What's this group about?" className={inputCls} />
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
