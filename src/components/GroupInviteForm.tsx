"use client";

import { useActionState, useRef, useState } from "react";
import { inviteGroupMember } from "@/actions/groups";
import { inputCls } from "./ui";
import { UsernameAutocomplete } from "./UsernameAutocomplete";

/** Owner/manager surface to add a member by username. */
export function GroupInviteForm({ groupId, slug }: { groupId: string; slug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [state, action, pending] = useActionState(
    async (_prev: { error?: string; ok?: boolean } | undefined, formData: FormData) => {
      const result = await inviteGroupMember(_prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setResetSignal((value) => value + 1);
      }
      return result;
    },
    undefined,
  );

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
      <UsernameAutocomplete name="username" required maxLength={24} placeholder="Invite by username…" className={`${inputCls} py-1.5 text-xs`} wrapperClassName="min-w-40 flex-1" resetSignal={resetSignal} />
      <button disabled={pending} className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent disabled:opacity-50">
        {pending ? "Adding…" : "Invite"}
      </button>
      {state?.error && <span className="w-full text-[11px] text-danger">{state.error}</span>}
      {state?.ok && <span className="w-full text-[11px] text-accent">✓ Added to the group.</span>}
    </form>
  );
}
