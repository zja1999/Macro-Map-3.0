import { transferGroupOwnership } from "@/actions/groups";
import { Card, inputCls } from "./ui";

/** Hand a group to another member. Shown to the current owner (self-service) and
 * to platform moderators/admins. `candidates` is every member except the sitting
 * owner — the caller decides who may see this. */
export function TransferOwnershipForm({
  groupId,
  candidates,
  byModerator = false,
}: {
  groupId: string;
  candidates: { userId: string; username: string; displayName: string }[];
  byModerator?: boolean;
}) {
  return (
    <Card className={`space-y-2 p-3 ${byModerator ? "border-danger/30" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {byModerator ? "Moderator · transfer ownership" : "Transfer ownership"}
      </div>
      {candidates.length === 0 ? (
        <p className="text-xs text-ink-faint">
          No other members yet — someone has to join before you can hand off the group.
        </p>
      ) : (
        <form action={transferGroupOwnership} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="groupId" value={groupId} />
          <select name="newOwnerId" required defaultValue="" className={`${inputCls} min-w-48 flex-1 py-1.5 text-xs`}>
            <option value="" disabled>
              Choose a member…
            </option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.displayName} (@{c.username})
              </option>
            ))}
          </select>
          <button className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-xs font-semibold text-accent">
            Transfer
          </button>
        </form>
      )}
    </Card>
  );
}
