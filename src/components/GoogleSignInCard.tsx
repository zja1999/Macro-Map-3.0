import Link from "next/link";
import { btnGhost, btnPrimary } from "@/components/ui";

export function GoogleSignInCard({
  next,
  error,
  heading = "Welcome to MacroVerse",
  message = "Continue with your Google account to sign in or create your profile.",
}: {
  next: string;
  error?: string;
  heading?: string;
  message?: string;
}) {
  const googleHref = `/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="space-y-4 rounded-xl border border-edge bg-card p-6">
        <div className="space-y-1">
          <h1 className="text-lg font-bold">{heading}</h1>
          <p className="text-sm text-ink-dim">{message}</p>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Link href={googleHref} className={`${btnPrimary} w-full`}>
          Continue with Google
        </Link>
      </div>
      <Link href="/recipes" className={`${btnGhost} w-full`}>
        Browse without an account →
      </Link>
      <p className="text-center text-[10px] text-ink-faint">
        Peek at recipes, workouts, and restaurants. Sign in to log meals, follow people, and join challenges.
      </p>
    </div>
  );
}
