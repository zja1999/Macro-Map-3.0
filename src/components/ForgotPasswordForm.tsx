"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/actions/auth";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6">
      <h1 className="text-lg font-bold">Reset your password</h1>
      <form action={action} className="space-y-3">
        <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputCls} />
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          {pending ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <Link href="/login" className={`${btnGhost} w-full`}>
        Back to sign in
      </Link>
    </div>
  );
}
