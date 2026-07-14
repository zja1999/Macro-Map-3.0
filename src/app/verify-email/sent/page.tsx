import Link from "next/link";
import { btnGhost } from "@/components/ui";

export default async function VerifyEmailSentPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const invalid = (await searchParams).status === "invalid";
  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6">
      <h1 className="text-lg font-bold">{invalid ? "Link expired" : "Email verification retired"}</h1>
      <p className="text-sm text-ink-dim">
        {invalid ? "That legacy verification link is invalid or expired." : "New accounts use a username and password and do not require email verification."}
      </p>
      <Link href="/login" className={`${btnGhost} w-full`}>Back to sign in</Link>
    </div>
  );
}
