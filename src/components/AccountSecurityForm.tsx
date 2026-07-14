"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePassword } from "@/actions/auth";
import { btnGhost, btnPrimary, inputCls } from "@/components/ui";

export function AccountSecurityForm({
  googleEmail,
  recentlyReauthenticated,
  notice,
  error,
}: {
  googleEmail: string | null;
  recentlyReauthenticated: boolean;
  notice?: string;
  error?: string;
}) {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <div className="space-y-5 rounded-xl border border-edge bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Account security</h2>
        <p className="mt-1 text-xs text-ink-faint">Your public username is also your sign-in name and cannot be changed.</p>
      </div>
      {notice && <p className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-accent">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge p-3">
        <div>
          <div className="text-xs font-semibold">Google recovery</div>
          <div className="mt-0.5 text-xs text-ink-faint">{googleEmail ? `Connected: ${googleEmail}` : "Not connected"}</div>
        </div>
        {googleEmail ? (
          <span className="text-xs font-semibold text-accent">Connected</span>
        ) : (
          <Link href="/api/auth/google/start?purpose=link&next=%2Fsettings" className={btnGhost}>Connect Google</Link>
        )}
      </div>
      <form action={action} className="space-y-3">
        <div>
          <h3 className="text-xs font-semibold">Change password</h3>
          <p className="mt-1 text-xs text-ink-faint">Enter the current password, or verify with your linked Google account first.</p>
        </div>
        <input name="currentPassword" type="password" placeholder={recentlyReauthenticated ? "Current password (not required after recent verification)" : "Current password"} autoComplete="current-password" className={inputCls} />
        <input name="password" type="password" required minLength={12} maxLength={64} placeholder="New password (12+ characters)" autoComplete="new-password" className={inputCls} />
        <input name="passwordConfirmation" type="password" required minLength={12} maxLength={64} placeholder="Confirm new password" autoComplete="new-password" className={inputCls} />
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className={btnPrimary}>{pending ? "Updating..." : "Update password"}</button>
          {googleEmail && !recentlyReauthenticated && <Link href="/api/auth/google/start?purpose=reauthenticate&next=%2Fsettings" className={btnGhost}>Verify with Google</Link>}
          {recentlyReauthenticated && <span className="text-xs text-accent">Recently verified</span>}
        </div>
        {state?.error && <p className="text-xs text-danger">{state.error}</p>}
        {state?.ok && <p className="text-xs text-accent">{state.ok}</p>}
      </form>
    </div>
  );
}
