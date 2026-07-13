import Link from "next/link";
import { ResendVerificationForm } from "@/components/ResendVerificationForm";
import { btnGhost } from "@/components/ui";
import { GoogleSignInCard } from "@/components/GoogleSignInCard";
import { isEmailPasswordAuthEnabled } from "@/lib/authFeatures";

export default async function VerifyEmailSentPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; status?: string }>;
}) {
  if (!isEmailPasswordAuthEnabled()) {
    return <GoogleSignInCard next="" heading="Sign in with Google" message="Email verification and resend are unavailable while Google is the only sign-in method." />;
  }
  const params = await searchParams;
  const invalid = params.status === "invalid";
  const email = params.email ?? "";

  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6">
      <h1 className="text-lg font-bold">{invalid ? "Link expired" : "Check your email"}</h1>
      <p className="text-sm text-ink-dim">
        {invalid
          ? "That verification link is invalid or expired. Send yourself a fresh one."
          : "Open the verification link to finish creating your Macroverse account."}
      </p>
      <ResendVerificationForm defaultEmail={email} />
      <Link href="/login" className={`${btnGhost} w-full`}>
        Back to sign in
      </Link>
    </div>
  );
}
