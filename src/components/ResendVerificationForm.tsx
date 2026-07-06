"use client";

import { useActionState } from "react";
import { resendVerificationEmail } from "@/actions/auth";
import { btnGhost, inputCls } from "@/components/ui";

export function ResendVerificationForm() {
  const [state, action, pending] = useActionState(resendVerificationEmail, undefined);

  return (
    <form action={action} className="space-y-2 rounded-xl border border-edge bg-card p-4">
      <p className="text-xs font-semibold text-ink-dim">Need a new verification link?</p>
      <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputCls} />
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      {state?.success && <p className="text-xs text-accent">{state.success}</p>}
      <button disabled={pending} className={`${btnGhost} w-full`}>
        {pending ? "Sending..." : "Resend verification email"}
      </button>
    </form>
  );
}
