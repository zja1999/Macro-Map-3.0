import Link from "next/link";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { btnGhost } from "@/components/ui";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
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
