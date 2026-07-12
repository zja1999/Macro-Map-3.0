"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { submitFeedback } from "@/actions/feedback";
import { Button, btnPrimary, inputCls } from "./ui";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(submitFeedback, undefined);
  const pathname = usePathname();

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 p-0 sm:w-auto sm:px-3"
        aria-label="Send feedback"
        aria-expanded={open}
      >
        <span className="hidden sm:inline">Feedback</span>
        <MessageSquare className="sm:hidden" size={17} strokeWidth={1.8} aria-hidden="true" />
      </Button>
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
