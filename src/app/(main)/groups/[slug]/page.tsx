import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges, groupMembers, groups, profiles } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getGroupFeed } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { toggleGroupMembership } from "@/actions/groups";
import { Card, Badge, Avatar, EmptyState } from "@/components/ui";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";
import { ContainerModeration } from "@/components/ContainerModeration";
import { TransferOwnershipForm } from "@/components/TransferOwnershipForm";
import { GroupMemberManager } from "@/components/GroupMemberManager";

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;

  const [group] = await db.select().from(groups).where(eq(groups.slug, slug)).limit(1);
  if (!group) notFound();

  // my standing in this group determines what tools I see
  const [myMembership] = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id)));
  const isMember = !!myMembership;
  const isOwner = myMembership?.role === "owner";
  const platformMod = isModerator(user); // moderates any group + platform delete/warn tools
  const ownerLevel = platformMod || isOwner; // may change roles, remove moderators
  const canManage = ownerLevel || myMembership?.role === "moderator"; // may moderate posts + members
  const canTransfer = isOwner || platformMod;

  const [feed, members, groupChallenges] = await Promise.all([
    getGroupFeed(user.id, group.id, canManage), // managers also see removed posts
    db
      .select({ m: groupMembers, username: profiles.username, displayName: profiles.displayName })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id))
      .orderBy(groupMembers.joinedAt)
      .limit(12),
    db.select().from(challenges).where(eq(challenges.groupId, group.id)).orderBy(desc(challenges.endsOn)).limit(5),
  ]);

  // full roster (owner → mods → members) for the management surface + transfer picker
  const roster = canManage
    ? await db
        .select({ userId: groupMembers.userId, username: profiles.username, displayName: profiles.displayName, role: groupMembers.role })
        .from(groupMembers)
        .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
        .where(eq(groupMembers.groupId, group.id))
        .orderBy(sql`CASE ${groupMembers.role} WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END`, groupMembers.joinedAt)
        .limit(100)
    : [];
  const transferCandidates = canTransfer ? roster.filter((m) => m.role !== "owner") : [];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold leading-tight">{group.name}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
              <Badge>{group.kind}</Badge>
              <span>{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          {myMembership?.role !== "owner" && (
            <form action={toggleGroupMembership} className="shrink-0">
              <input type="hidden" name="groupId" value={group.id} />
              <input type="hidden" name="slug" value={group.slug} />
              <button
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  isMember ? "border border-edge bg-card text-ink-dim" : "bg-accent text-black"
                }`}
              >
                {isMember ? "Leave" : "Join group"}
              </button>
            </form>
          )}
        </div>
        {group.description && <p className="text-sm text-ink-dim">{group.description}</p>}
      </div>

      {isOwner && <TransferOwnershipForm groupId={group.id} candidates={transferCandidates} />}
      {platformMod && !isOwner && (
        <TransferOwnershipForm groupId={group.id} candidates={transferCandidates} byModerator />
      )}
      {platformMod && <ContainerModeration kind="group" id={group.id} />}

      {/* members strip */}
      <Card className="flex items-center gap-2 overflow-x-auto p-3">
        {members.map(({ username, displayName }) => (
          <Link key={username} href={`/u/${username}`} title={displayName} className="shrink-0">
            <Avatar name={displayName} size={30} />
          </Link>
        ))}
        {group.memberCount > members.length && (
          <span className="shrink-0 text-xs text-ink-faint">+{group.memberCount - members.length} more</span>
        )}
      </Card>

      {canManage && (
        <GroupMemberManager
          groupId={group.id}
          slug={group.slug}
          members={roster}
          ownerLevel={ownerLevel}
          viewerId={user.id}
        />
      )}

      {/* group challenges */}
      {groupChallenges.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-dim">🏆 Group challenges</h2>
          {groupChallenges.map((c) => (
            <Card key={c.id} className="flex items-center justify-between p-3">
              <div>
                <Link href={`/challenges/${c.id}`} className="text-sm font-medium hover:text-accent">
                  {c.title}
                </Link>
                <div className="text-[11px] text-ink-faint">
                  {c.target} {c.unit} · {c.startsOn} → {c.endsOn}
                  {c.endsOn < todayStr() && " · ended"}
                </div>
              </div>
              <Link href={`/challenges/${c.id}`} className="text-xs font-semibold text-accent hover:underline">
                View →
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* group feed */}
      {isMember ? (
        <PostComposer group={{ id: group.id, slug: group.slug, name: group.name }} />
      ) : (
        <p className="rounded-xl border border-dashed border-edge px-4 py-3 text-center text-xs text-ink-faint">
          Join the group to post.
        </p>
      )}
      {feed.length === 0 ? (
        <EmptyState title="No posts yet" hint="Be the first — a check-in, a question, this week's prep." />
      ) : (
        <div className="space-y-3">
          {feed.map((fp) => (
            <PostCard
              key={fp.post.id}
              item={fp}
              canModerate={platformMod}
              moderationPath={`/groups/${group.slug}`}
              groupModeration={canManage && !platformMod ? { groupId: group.id, slug: group.slug } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
