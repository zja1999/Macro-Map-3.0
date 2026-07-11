"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/actions/account";
import { Sheet } from "./overlays";
import { Button, inputCls } from "./ui";
import { haptic } from "@/lib/haptic";

/**
 * Danger-zone row for Settings: opens a confirm Sheet (overlay policy §2.3 — never
 * window.confirm) that requires typing DELETE before the irreversible server action
 * runs. On success the action redirects to /login, so there's no success state here.
 */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(deleteAccount, undefined);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-danger">Delete account</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Permanently deletes your account and all your data. This can&apos;t be undone.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            haptic("warning");
            setConfirm("");
            setOpen(true);
          }}
        >
          Delete
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen} title="Delete account?">
        <form action={action} className="space-y-4">
          <p className="text-sm text-ink-dim">
            This permanently deletes your profile, food and workout logs, posts, comments, and every
            other trace of your account. Any groups you created are deleted too. This cannot be undone.
          </p>
          <label className="block space-y-1 text-xs text-ink-dim">
            Type <span className="font-mono font-semibold text-danger">DELETE</span> to confirm
            <input
              name="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className={inputCls}
            />
          </label>
          {state?.error && <p className="text-xs text-danger">{state.error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="lg" disabled={pending || confirm.trim() !== "DELETE"}>
              {pending ? "Deleting…" : "Delete forever"}
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
}
