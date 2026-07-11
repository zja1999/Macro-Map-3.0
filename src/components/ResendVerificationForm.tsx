"use client";

import { useActionState } from "react";
import { resendVerification } from "@/actions/auth";
import { btnPrimary, inputCls } from "@/components/ui";

export function ResendVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(resendVerification, undefined);
  return (
    <form action={action} className="space-y-3">
      <input name="email" type="email" required defaultValue={defaultEmail} placeholder="Email" className={inputCls} />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p className="text-sm text-accent">{state.ok}</p>}
      <button disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Sending..." : "Resend verification"}
      </button>
    </form>
  );
}
