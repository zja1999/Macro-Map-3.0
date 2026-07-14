import Link from "next/link";
import { btnGhost, btnPrimary } from "@/components/ui";

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border border-edge bg-card p-6">
      <div>
        <h1 className="text-lg font-bold">Recover your account</h1>
        <p className="mt-1 text-sm text-ink-dim">If you previously connected Google, verify that linked account to sign in and choose a new password.</p>
      </div>
      <Link href="/api/auth/google/start?purpose=recover" className={`${btnPrimary} w-full`}>Recover with linked Google</Link>
      <p className="text-xs text-ink-faint">Google recovery cannot create or link a new account. Accounts without a linked Google identity cannot be recovered after logout.</p>
      <Link href="/login" className={`${btnGhost} w-full`}>Back to sign in</Link>
    </div>
  );
}
