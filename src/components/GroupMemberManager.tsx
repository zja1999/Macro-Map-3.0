import Link from "next/link";
import { removeGroupMember, setGroupMemberRole } from "@/actions/groups";
import { Card, Avatar, Badge } from "./ui";
import { GroupInviteForm } from "./GroupInviteForm";

type Member = { userId: string; username: string; displayName: string; role: string };

/** Member roster with moderation controls for a group's owner/moderators.
 * `ownerLevel` (owner or platform mod) unlocks role changes and removing
 * moderators; a plain group moderator can only remove regular members. */
export function GroupMemberManager({
  groupId,
  slug,
  members,
  ownerLevel,
  viewerId,
}: {
  groupId: string;
  slug: string;
  members: Member[];
  ownerLevel: boolean;
  viewerId: string;
}) {
  const hidden = (
    <>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="slug" value={slug} />
    </>
  );

  return (
    <Card className="space-y-2 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Manage members</div>
      <GroupInviteForm groupId={groupId} slug={slug} />
      <ul className="divide-y divide-edge">
        {members.map((m) => {
          const isOwner = m.role === "owner";
          const isMod = m.role === "moderator";
          const isSelf = m.userId === viewerId;
          // owner is never removable; a group mod can only remove plain members
          const canRemove = !isOwner && !isSelf && (ownerLevel || m.role === "member");
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-2 py-2">
              <Link href={`/u/${m.username}`} className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar name={m.displayName} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-sm">{m.displayName}</span>
                  <span className="block truncate text-[11px] text-ink-faint">@{m.username}</span>
                </span>
              </Link>
              {isOwner && <Badge tone="accent">owner</Badge>}
              {isMod && <Badge tone="warn">moderator</Badge>}

              {ownerLevel && !isOwner && (
                <form action={setGroupMemberRole}>
                  {hidden}
                  <input type="hidden" name="userId" value={m.userId} />
                  <input type="hidden" name="role" value={isMod ? "member" : "moderator"} />
                  <button className="rounded-lg border border-edge bg-card px-2 py-1 text-[11px] font-semibold text-ink-dim hover:text-ink">
                    {isMod ? "Remove mod" : "Make mod"}
                  </button>
                </form>
              )}
              {canRemove && (
                <form action={removeGroupMember}>
                  {hidden}
                  <input type="hidden" name="userId" value={m.userId} />
                  <button className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] font-semibold text-danger">
                    Remove
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
