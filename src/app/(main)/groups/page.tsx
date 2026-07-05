import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { groupMembers, groups } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { toggleGroupMembership } from "@/actions/groups";
import { Card, Badge, EmptyState } from "@/components/ui";
import { GroupCreateForm } from "./GroupCreateForm";

export const metadata = { title: "Groups" };

const KIND_EMOJI: Record<string, string> = {
  goal: "🎯",
  diet: "🥗",
  location: "📍",
  gym: "🏋️",
  interest: "💬",
};

export default async function GroupsPage() {
  const user = await requireUser();
  const rows = await db.select().from(groups).orderBy(desc(groups.memberCount)).limit(50);
  const myMemberships = rows.length
    ? await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.userId, user.id))
    : [];
  const mine = new Set(myMemberships.map((m) => m.groupId));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">👥 Groups</h1>
      </div>
      <GroupCreateForm />

      {rows.length === 0 ? (
        <EmptyState title="No groups yet" hint="Start the first one — goal, diet, gym, or city." />
      ) : (
        <div className="space-y-2">
          {rows.map((g) => (
            <Card key={g.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <Link href={`/groups/${g.slug}`} className="text-sm font-medium hover:text-accent">
                  {KIND_EMOJI[g.kind] ?? "👥"} {g.name}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                  <Badge>{g.kind}</Badge>
                  <span>{g.memberCount} member{g.memberCount === 1 ? "" : "s"}</span>
                </div>
                {g.description && <p className="mt-1 truncate text-xs text-ink-dim">{g.description}</p>}
              </div>
              <form action={toggleGroupMembership} className="shrink-0">
                <input type="hidden" name="groupId" value={g.id} />
                <input type="hidden" name="slug" value={g.slug} />
                <button
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    mine.has(g.id)
                      ? "border border-edge bg-card text-ink-dim"
                      : "bg-accent text-black"
                  }`}
                >
                  {mine.has(g.id) ? "Joined ✓" : "Join"}
                </button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
