"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, continueAsGuest } from "@/actions/auth";
import { inputCls, btnPrimary, btnGhost } from "@/components/ui";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="w-full max-w-sm space-y-3">
      <form action={action} className="space-y-3 rounded-xl border border-edge bg-card p-6">
        <h1 className="text-lg font-bold">Welcome back</h1>
        <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputCls} />
        <input
          name="password"
          type="password"
          required
          placeholder="Password"
          autoComplete="current-password"
          className={inputCls}
        />
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button disabled={pending} className={`${btnPrimary} w-full`}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-xs text-ink-faint">
          New here?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
        <p className="rounded-lg bg-surface px-3 py-2 text-center text-[11px] text-ink-faint">
          Demo account: <span className="text-ink-dim">demo@macromap.app</span> / <span className="text-ink-dim">password123</span>
        </p>
      </form>
      {/* guest mode (docs/08 §1a): zero-signup start; claim the account later in Settings */}
      <form action={continueAsGuest}>
        <button className={`${btnGhost} w-full`}>👋 Try it without an account</button>
      </form>
      <p className="text-center text-[10px] text-ink-faint">
        Guest sessions track everything on this device — add an email later to keep it.
      </p>
    </div>
  );
}
