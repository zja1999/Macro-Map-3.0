import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges, groupMembers, groups, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getGroupFeed } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { toggleGroupMembership } from "@/actions/groups";
import { Card, Badge, Avatar, EmptyState } from "@/components/ui";
import { PostComposer } from "@/components/PostComposer";
import { PostCard } from "@/components/PostCard";

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = (await getCurrentUser())!;
  const { slug } = await params;

  const [group] = await db.select().from(groups).where(eq(groups.slug, slug)).limit(1);
  if (!group) notFound();

  const [feed, members, groupChallenges, [myMembership]] = await Promise.all([
    getGroupFeed(user.id, group.id),
    db
      .select({ m: groupMembers, username: profiles.username, displayName: profiles.displayName })
      .from(groupMembers)
      .innerJoin(profiles, eq(profiles.userId, groupMembers.userId))
      .where(eq(groupMembers.groupId, group.id))
      .orderBy(groupMembers.joinedAt)
      .limit(12),
    db.select().from(challenges).where(eq(challenges.groupId, group.id)).orderBy(desc(challenges.endsOn)).limit(5),
    db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, user.id))),
  ]);
  const isMember = !!myMembership;

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
            <PostCard key={fp.post.id} item={fp} />
          ))}
        </div>
      )}
    </div>
  );
}
