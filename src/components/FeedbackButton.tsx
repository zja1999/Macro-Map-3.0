"use client";

import { useActionState, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import { submitFeedback } from "@/actions/feedback";
import { Sheet } from "./overlays";
import { Button, btnPrimary, inputCls } from "./ui";

export function FeedbackButton() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [state, action, pending] = useActionState(submitFeedback, undefined);
  const pathname = usePathname();

  const fields = (
    <>
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
    </>
  );

  return (
    <div className="relative">
      <Sheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Send feedback"
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            aria-label="Send feedback"
          >
            <MessageSquare size={17} strokeWidth={1.8} aria-hidden="true" />
          </Button>
        }
      >
        <form action={action} className="space-y-3">
          {fields}
        </form>
      </Sheet>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDesktopOpen((open) => !open)}
        className="hidden md:inline-flex"
        aria-label="Send feedback"
        aria-expanded={desktopOpen}
      >
        Feedback
      </Button>
      {desktopOpen && (
        <form
          action={action}
          className="absolute right-0 top-10 z-50 hidden w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-lg border border-edge bg-card p-3 shadow-xl md:block"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Send feedback</h2>
            <button
              type="button"
              onClick={() => setDesktopOpen(false)}
              className="text-ink-faint hover:text-ink"
              aria-label="Close feedback"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {fields}
        </form>
      )}
    </div>
  );
}
