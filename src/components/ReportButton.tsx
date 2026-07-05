"use client";

import { useActionState } from "react";
import { submitReport } from "@/actions/moderation";
import { inputCls } from "./ui";

const REASONS: [string, string][] = [
  ["inaccurate_macros", "Inaccurate macros"],
  ["unsafe_advice", "Unsafe advice"],
  ["harassment", "Harassment"],
  ["body_shaming", "Body shaming"],
  ["ed_content", "ED-promoting content"],
  ["spam", "Spam"],
  ["stolen_content", "Stolen content"],
  ["fake_transformation", "Fake transformation"],
  ["medical_claim", "Medical claim"],
  ["other", "Other"],
];

/** Everything is reportable with a structured reason (docs/07 §2). */
export function ReportButton({ subjectType, subjectId }: { subjectType: "post" | "recipe" | "comment"; subjectId: string }) {
  const [state, action, pending] = useActionState(submitReport, undefined);

  if (state?.ok) {
    return <span className="text-[11px] text-ink-faint">✓ Reported — thank you, a moderator will review it.</span>;
  }

  return (
    <details className="text-[11px] text-ink-faint">
      <summary className="cursor-pointer hover:text-ink-dim">🚩 Report</summary>
      <form action={action} className="mt-2 flex max-w-sm flex-wrap items-center gap-2">
        <input type="hidden" name="subjectType" value={subjectType} />
        <input type="hidden" name="subjectId" value={subjectId} />
        <select name="reason" required className={`${inputCls} w-auto py-1.5 text-xs`} defaultValue="">
          <option value="" disabled>
            Why?
          </option>
          {REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input name="detail" maxLength={500} placeholder="Details (optional)" className={`${inputCls} w-40 py-1.5 text-xs`} />
        <button disabled={pending} className="rounded-lg border border-edge bg-card px-2.5 py-1.5 text-xs text-ink-dim hover:text-danger">
          {pending ? "Sending…" : "Submit"}
        </button>
        {state?.error && <span className="text-danger">{state.error}</span>}
      </form>
    </details>
  );
}
