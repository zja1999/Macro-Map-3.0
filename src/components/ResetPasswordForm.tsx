"use client";

import { useActionState } from "react";
import { resetPassword } from "@/actions/auth";
import { btnPrimary, inputCls } from "@/components/ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <input
        name="password"
        type="password"
        required
        minLength={12}
        maxLength={64}
        placeholder="New password (12+ characters)"
        autoComplete="new-password"
        className={inputCls}
      />
      <input
        name="passwordConfirmation"
        type="password"
        required
        minLength={12}
        maxLength={64}
        placeholder="Confirm new password"
        autoComplete="new-password"
        className={inputCls}
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending || !token} className={`${btnPrimary} w-full`}>
        {pending ? "Saving..." : "Reset password"}
      </button>
    </form>
  );
}
