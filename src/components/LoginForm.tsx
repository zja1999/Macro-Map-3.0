"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/actions/auth";
import { inputCls, btnPrimary, btnGhost } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return <div className="w-full max-w-sm space-y-3"><form action={action} className="space-y-3 rounded-xl border border-edge bg-card p-6"><input type="hidden" name="next" value={next}/><h1 className="text-lg font-bold">Welcome back</h1><input name="email" type="email" required placeholder="Email" autoComplete="email" className={inputCls}/><input name="password" type="password" required placeholder="Password" autoComplete="current-password" className={inputCls}/>{state?.error && <p className="text-sm text-danger">{state.error}</p>}<button disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Signing in…" : "Sign in"}</button><p className="text-center text-xs text-ink-faint"><Link href="/forgot-password" className="text-accent hover:underline">Forgot your password?</Link></p><div className="flex items-center gap-3 py-1 text-xs text-ink-faint"><span className="h-px flex-1 bg-edge"/>or<span className="h-px flex-1 bg-edge"/></div><Link href={`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={`${btnGhost} w-full`}>Continue with Google</Link><p className="text-center text-xs text-ink-faint">New here? <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-accent hover:underline">Create an account</Link></p></form><Link href="/recipes" className={`${btnGhost} w-full`}>Browse without an account →</Link><p className="text-center text-[10px] text-ink-faint">Peek at recipes, workouts, and restaurants. Sign up to log meals, follow people, and join challenges.</p></div>;
}
