"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeAccountSetup } from "@/actions/auth";
import { btnPrimary, inputCls } from "@/components/ui";

export function AccountSetupForm({ username, canSubmit, googleError }: { username: string; canSubmit: boolean; googleError?: string }) {
  const [state, action, pending] = useActionState(completeAccountSetup, undefined);
  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6">
      <div>
        <h1 className="text-lg font-bold">Secure your account</h1>
        <p className="mt-1 text-sm text-ink-dim">Choose the public username and fallback password you can use without Google.</p>
      </div>
      {googleError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{googleError}</p>}
      {!canSubmit ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-dim">Verify the linked Google account again before adding a password to this existing session.</p>
          <Link href="/api/auth/google/start?purpose=reauthenticate&next=%2Faccount-setup" className={`${btnPrimary} w-full`}>
            Verify with Google
          </Link>
        </div>
      ) : (
        <form action={action} className="space-y-3">
          <input name="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" defaultValue={username} placeholder="Username" autoComplete="username" className={inputCls} />
          <input name="password" type="password" required minLength={12} maxLength={64} placeholder="Password (12+ characters)" autoComplete="new-password" className={inputCls} />
          <input name="passwordConfirmation" type="password" required minLength={12} maxLength={64} placeholder="Confirm password" autoComplete="new-password" className={inputCls} />
          {state?.error && <p className="text-sm text-danger">{state.error}</p>}
          <button disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Saving..." : "Continue"}</button>
        </form>
      )}
    </div>
  );
}
