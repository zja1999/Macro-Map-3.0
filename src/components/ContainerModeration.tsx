import { deleteGroup, deleteChallenge } from "@/actions/moderation";
import { Card, inputCls } from "./ui";

/** Moderator-only delete for a whole group or challenge. Both are permanent —
 * there's no soft-hide state — so this is a single destructive action with an
 * optional audit note. Gated by the caller (render only when isModerator). */
export function ContainerModeration({
  kind,
  id,
}: {
  kind: "group" | "challenge";
  id: string;
}) {
  const action = kind === "group" ? deleteGroup : deleteChallenge;
  const idField = kind === "group" ? "groupId" : "challengeId";

  return (
    <Card className="space-y-2 border-danger/30 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Moderator tools</div>
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name={idField} value={id} />
        <input
          name="note"
          maxLength={300}
          placeholder="Optional reason (audit log)"
          className={`${inputCls} min-w-40 flex-1 py-1.5 text-xs`}
        />
        <button className="rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-xs font-semibold text-danger">
          Delete {kind}
        </button>
      </form>
    </Card>
  );
}
