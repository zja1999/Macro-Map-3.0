"use client";

import { useActionState } from "react";
import { approveMacroTrayPairing } from "@/actions/macrotray";
import { btnPrimary } from "@/components/ui";

export function MacroTrayApproval({ code }: { code: string }) {
  const [state, action, pending] = useActionState(approveMacroTrayPairing, undefined);
  return (
    <form action={action} className="w-full max-w-sm space-y-4 rounded-xl border border-edge bg-card p-6 text-center">
      <input type="hidden" name="code" value={code} />
      <div className="text-3xl">🖥️</div>
      <h1 className="text-lg font-bold">Connect MacroTray?</h1>
      <p className="text-sm text-ink-dim">Only approve if you just opened MacroTray on your Windows PC. The widget receives its own revocable MacroVerse session.</p>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok ? <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm font-semibold text-accent">Connected. You can return to MacroTray and close this tab.</p> : <button disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Connecting…" : "Approve connection"}</button>}
    </form>
  );
}
