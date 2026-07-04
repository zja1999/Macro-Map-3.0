"use client";

import { useActionState, useRef } from "react";
import { createPost } from "@/actions/social";
import { inputCls, btnPrimary } from "./ui";

export function PostComposer() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    async (prev: { error?: string } | undefined, formData: FormData) => {
      const result = await createPost(prev, formData);
      if (!result.error) formRef.current?.reset();
      return result;
    },
    undefined,
  );

  return (
    <form ref={formRef} action={action} className="space-y-2 rounded-xl border border-edge bg-card p-3">
      <textarea
        name="body"
        rows={2}
        required
        maxLength={2000}
        placeholder="Share a win, a tip, a question…"
        className={`${inputCls} resize-none`}
      />
      <div className="flex items-center justify-between">
        <select name="type" className="rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs text-ink-dim">
          <option value="general">Update</option>
          <option value="tip">💡 Tip</option>
          <option value="question">❓ Question</option>
          <option value="progress">📈 Progress</option>
          <option value="personal_record">🏆 PR</option>
        </select>
        <div className="flex items-center gap-3">
          {state?.error && <span className="text-xs text-danger">{state.error}</span>}
          <button disabled={pending} className={btnPrimary}>
            {pending ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </form>
  );
}
