import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { btnGhost } from "@/components/ui";
import { GoogleSignInCard } from "@/components/GoogleSignInCard";
import { isEmailPasswordAuthEnabled } from "@/lib/authFeatures";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (!isEmailPasswordAuthEnabled()) {
    return <GoogleSignInCard next="" heading="Sign in with Google" message="Password reset is unavailable while Google is the only sign-in method." />;
  }
  const token = (await searchParams).token ?? "";
  return (
    <div className="w-full max-w-sm space-y-3 rounded-xl border border-edge bg-card p-6">
      <h1 className="text-lg font-bold">Choose a new password</h1>
      <ResetPasswordForm token={token} />
      {!token && <p className="text-sm text-danger">This reset link is missing its token.</p>}
      <Link href="/login" className={`${btnGhost} w-full`}>
        Back to sign in
      </Link>
    </div>
  );
}
