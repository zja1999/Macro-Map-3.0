"use client";

import { useActionState, useState } from "react";
import { recordProgressPhoto, saveProgressEntry } from "@/actions/progress";
import { inputCls, btnPrimary, btnGhost } from "./ui";

export function WeighInForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(saveProgressEntry, undefined);
  const [showMore, setShowMore] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entryDate" value={today} />
      <div className="flex gap-2">
        <label className="min-w-0 flex-1 space-y-1 text-[10px] text-ink-dim">
          Weight (kg)
          <input type="number" name="weightKg" step="0.1" min={20} max={400} className={inputCls} autoFocus />
        </label>
        <label className="min-w-0 flex-1 space-y-1 text-[10px] text-ink-dim">
          Body fat % <span className="text-ink-faint">(optional)</span>
          <input type="number" name="bodyFatPct" step="0.1" min={1} max={75} className={inputCls} />
        </label>
      </div>

      {showMore && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["waistCm", "Waist (cm)"],
              ["chestCm", "Chest (cm)"],
              ["hipsCm", "Hips (cm)"],
              ["armsCm", "Arms (cm)"],
            ] as const
          ).map(([name, label]) => (
            <label key={name} className="space-y-1 text-[10px] text-ink-dim">
              {label}
              <input type="number" name={name} step="0.1" min={10} max={250} className={inputCls} />
            </label>
          ))}
          <label className="col-span-2 space-y-1 text-[10px] text-ink-dim sm:col-span-4">
            Note
            <input name="note" maxLength={300} placeholder="How's it going?" className={inputCls} />
          </label>
        </div>
      )}

      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save entry"}
        </button>
        <button type="button" onClick={() => setShowMore(!showMore)} className={btnGhost}>
          {showMore ? "Less" : "+ Measurements"}
        </button>
      </div>
      <p className="text-[10px] text-ink-faint">
        Progress data is <span className="font-medium text-ink-dim">private by default</span> — nothing here is shared
        unless you post it yourself.
      </p>
    </form>
  );
}

export function ProgressPhotoForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(recordProgressPhoto, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entryDate" value={today} />
      <label className="block space-y-1 text-xs text-ink-dim">
        R2 object key
        <input name="storageKey" required maxLength={300} placeholder="progress/user-id/photo.webp" className={inputCls} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 text-[10px] text-ink-dim">
          Type
          <select name="mimeType" defaultValue="image/jpeg" className={inputCls}>
            <option value="image/jpeg">JPEG</option>
            <option value="image/png">PNG</option>
            <option value="image/webp">WebP</option>
          </select>
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Width
          <input type="number" name="width" min={1} max={10000} className={inputCls} />
        </label>
        <label className="space-y-1 text-[10px] text-ink-dim">
          Height
          <input type="number" name="height" min={1} max={10000} className={inputCls} />
        </label>
      </div>
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Attaching..." : "Attach private photo"}
        </button>
        {state?.ok && <span className="text-xs text-accent">Attached</span>}
      </div>
      <p className="text-[10px] text-ink-faint">
        This records the private photo after an R2 upload. The upload endpoint will generate this key once R2 credentials
        are configured.
      </p>
    </form>
  );
}
