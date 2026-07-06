import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyEmailToken } from "@/lib/auth";
import { btnGhost, btnPrimary } from "@/components/ui";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) redirect("/login");

  const result = await verifyEmailToken(token);
  if (result === "ok") redirect("/onboarding");

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6 text-center">
      <h1 className="text-lg font-bold">Verification link expired</h1>
      <p className="text-sm text-ink-dim">Request a new verification email, then use the latest link in your inbox.</p>
      <Link href="/login" className={`${btnPrimary} w-full`}>
        Back to sign in
      </Link>
      <Link href="/register" className={`${btnGhost} w-full`}>
        Create a new account
      </Link>
    </div>
  );
}
