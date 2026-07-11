"use client";

import Link from "next/link";
import { useActionState } from "react";
import { register } from "@/actions/auth";
import { inputCls, btnPrimary } from "@/components/ui";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(register, undefined);
  return (
    <form action={action} className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6">
      <h1 className="text-lg font-bold">Create your account</h1>
      <input name="displayName" required maxLength={40} placeholder="Display name" className={inputCls} />
      <input
        name="username"
        required
        minLength={3}
        maxLength={24}
        pattern="[A-Za-z0-9_]+"
        placeholder="Username"
        autoComplete="username"
        className={inputCls}
      />
      <input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputCls} />
      <input
        name="password"
        type="password"
        required
        minLength={8}
        placeholder="Password (8+ characters)"
        autoComplete="new-password"
        className={inputCls}
      />
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Creating…" : "Sign up"}
      </button>
      <div className="flex items-center gap-3 py-1 text-xs text-ink-faint" aria-hidden="true">
        <span className="h-px flex-1 bg-edge" />
        or
        <span className="h-px flex-1 bg-edge" />
      </div>
      <Link href="/api/auth/google/start" className={`${btnPrimary} w-full`}>
        Continue with Google
      </Link>
      <p className="text-center text-xs text-ink-faint">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
