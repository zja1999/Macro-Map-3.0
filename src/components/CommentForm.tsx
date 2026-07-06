"use client";

import { useActionState, useRef } from "react";
import { addComment } from "@/actions/social";
import { inputCls, btnPrimary } from "./ui";

/** Comment box. Uses a pending state to disable the button while the action is
 * in flight, so a quick double-click can't post the same comment twice. */
export function CommentForm({ subjectType, subjectId }: { subjectType: "post" | "recipe"; subjectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [, action, pending] = useActionState(
    async (_prev: undefined, formData: FormData) => {
      await addComment(formData);
      formRef.current?.reset();
      return undefined;
    },
    undefined,
  );

  return (
    <form ref={formRef} action={action} className="flex gap-2">
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <input name="body" required maxLength={1000} placeholder="Add a comment…" className={inputCls} />
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
