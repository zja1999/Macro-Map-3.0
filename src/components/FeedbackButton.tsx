"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/actions/feedback";
import { btnGhost, btnPrimary, inputCls } from "./ui";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submitFeedback, undefined);
  const pathname = usePathname();

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={`${btnGhost} px-2 py-1.5 text-xs sm:px-3`} aria-label="Send feedback">
        <span className="hidden sm:inline">Feedback</span>
        <span className="sm:hidden">?</span>
      </button>
      {open && (
        <form
          action={action}
          className="absolute right-0 top-10 z-50 w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-lg border border-edge bg-card p-3 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Send feedback</h2>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-faint hover:text-ink" aria-label="Close feedback">
              ×
            </button>
          </div>
          <input type="hidden" name="pageContext" value={pathname} />
          <textarea
            name="body"
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            placeholder="Bug, idea, confusing screen..."
            className={`${inputCls} resize-none`}
          />
          <div className="flex items-center gap-3">
            <button disabled={pending} className={`${btnPrimary} px-3 py-1.5 text-xs`}>
              {pending ? "Sending..." : "Send"}
            </button>
            {state?.ok && <span className="text-xs text-accent">Thanks, got it.</span>}
            {state?.error && <span className="text-xs text-danger">{state.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
