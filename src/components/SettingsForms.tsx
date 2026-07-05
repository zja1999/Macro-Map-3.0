"use client";

import { useActionState } from "react";
import { usePathname } from "next/navigation";
import { updateProfile, updateTargets } from "@/actions/onboarding";
import { claimAccount } from "@/actions/auth";
import { submitFeedback } from "@/actions/feedback";
import { inputCls, btnPrimary } from "./ui";
import { CALORIE_FLOOR } from "@/lib/targets";

/** Guest → real account: attaches email/password to the same users row (docs/08 §1a). */
export function ClaimAccountForm() {
  const [state, action, pending] = useActionState(claimAccount, undefined);
  return (
    <form id="claim" action={action} className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-4">
      <h2 className="text-sm font-semibold">💾 Save your progress</h2>
      <p className="text-xs text-ink-dim">
        You&apos;re in guest mode — everything you&apos;ve logged stays with this account once you add an email and
        password. No data is lost or migrated.
      </p>
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
      {state?.error && <p className="text-xs text-danger">{state.error}</p>}
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Claiming…" : "Claim my account"}
      </button>
    </form>
  );
}

export function FeedbackForm() {
  const [state, action, pending] = useActionState(submitFeedback, undefined);
  const pathname = usePathname();
  return (
    <form action={action} className="space-y-3 rounded-xl border border-edge bg-card p-4">
      <h2 className="text-sm font-semibold">📮 Send feedback</h2>
      <input type="hidden" name="pageContext" value={pathname} />
      <textarea
        name="body"
        required
        minLength={5}
        maxLength={2000}
        rows={3}
        placeholder="Bug, idea, confusing screen — anything helps."
        className={`${inputCls} resize-none`}
      />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={btnPrimary}>
          {pending ? "Sending…" : "Send"}
        </button>
        {state?.ok && <span className="text-xs text-accent">Thanks — the team reads every one ✓</span>}
        {state?.error && <span className="text-xs text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function SettingsForms({
  profile,
  targets,
}: {
  profile: { displayName: string; bio: string; dietaryStyle: string; shareMacroGoals: boolean };
  targets: { calories: number; proteinG: number; carbsG: number; fatG: number };
}) {
  const [pState, pAction, pPending] = useActionState(updateProfile, undefined);
  const [tState, tAction, tPending] = useActionState(updateTargets, undefined);

  return (
    <div className="space-y-8">
      <form action={pAction} className="space-y-3 rounded-xl border border-edge bg-card p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <label className="block space-y-1 text-xs text-ink-dim">
          Display name
          <input name="displayName" defaultValue={profile.displayName} required maxLength={40} className={inputCls} />
        </label>
        <label className="block space-y-1 text-xs text-ink-dim">
          Bio
          <textarea name="bio" defaultValue={profile.bio} maxLength={280} rows={3} className={`${inputCls} resize-none`} />
        </label>
        <label className="block space-y-1 text-xs text-ink-dim">
          Dietary style
          <input name="dietaryStyle" defaultValue={profile.dietaryStyle} maxLength={40} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-dim">
          <input type="checkbox" name="shareMacroGoals" value="true" defaultChecked={profile.shareMacroGoals} />
          Show my macro targets on my public profile
        </label>
        <div className="flex items-center gap-3">
          <button disabled={pPending} className={btnPrimary}>
            {pPending ? "Saving…" : "Save profile"}
          </button>
          {pState?.ok && <span className="text-xs text-accent">Saved ✓</span>}
          {pState?.error && <span className="text-xs text-danger">{pState.error}</span>}
        </div>
      </form>

      <form action={tAction} className="space-y-3 rounded-xl border border-edge bg-card p-4">
        <h2 className="text-sm font-semibold">Daily targets</h2>
        <p className="text-xs text-ink-faint">
          Manual override — for safety, calories can&apos;t be set below {CALORIE_FLOOR}.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["calories", "kcal", targets.calories],
              ["proteinG", "Protein", targets.proteinG],
              ["carbsG", "Carbs", targets.carbsG],
              ["fatG", "Fat", targets.fatG],
            ] as const
          ).map(([name, label, def]) => (
            <label key={name} className="space-y-1 text-[10px] text-ink-dim">
              {label}
              <input type="number" name={name} defaultValue={def} className={inputCls} />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button disabled={tPending} className={btnPrimary}>
            {tPending ? "Saving…" : "Save targets"}
          </button>
          {tState?.ok && <span className="text-xs text-accent">Saved ✓</span>}
          {tState?.error && <span className="text-xs text-danger">{tState.error}</span>}
        </div>
      </form>
    </div>
  );
}
