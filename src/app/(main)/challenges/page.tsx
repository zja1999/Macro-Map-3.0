import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groupMembers, groups } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { listChallenges } from "@/lib/challenges";
import { joinChallenge } from "@/actions/groups";
import { todayStr, shiftDate } from "@/lib/utils";
import { Card, Badge, EmptyState } from "@/components/ui";
import { ChallengeCreateForm } from "./ChallengeCreateForm";

export const metadata = { title: "Challenges" };

export default async function ChallengesPage() {
  const user = (await getCurrentUser())!;
  const [rows, myGroups] = await Promise.all([
    listChallenges(user.id),
    db
      .select({ id: groups.id, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.userId, user.id)),
  ]);

  const active = rows.filter((r) => r.active);
  const ended = rows.filter((r) => !r.active);

  const renderRow = (r: (typeof rows)[number]) => {
    const pct = r.joined ? Math.min(100, (r.joined.progress / r.challenge.target) * 100) : 0;
    return (
      <Card key={r.challenge.id} className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/challenges/${r.challenge.id}`} className="text-sm font-medium hover:text-accent">
              {r.challenge.title}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-faint">
              {r.groupName ? (
                <Link href={`/groups/${r.groupSlug}`} className="hover:text-accent">
                  👥 {r.groupName}
                </Link>
              ) : (
                <Badge>🌍 global</Badge>
              )}
              <span>
                {r.challenge.target} {r.challenge.unit}
              </span>
              <span>
                {r.challenge.startsOn} → {r.challenge.endsOn}
              </span>
              <span>{r.participantCount} joined</span>
            </div>
            {r.joined && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-semibold tabular-nums text-ink-dim">
                  {Math.round(r.joined.progress)}/{r.challenge.target}
                  {r.joined.completedAt && " 🏆"}
                </span>
              </div>
            )}
          </div>
          {!r.joined && r.active && (
            <form action={joinChallenge} className="shrink-0">
              <input type="hidden" name="challengeId" value={r.challenge.id} />
              <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black">Join</button>
            </form>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-base font-bold">🏆 Challenges</h1>
      <p className="text-xs text-ink-faint">
        Behavior-based, auto-scored from what you already log — protein days, logged days, workouts. Never
        weight-loss-amount contests.
      </p>
      <ChallengeCreateForm today={todayStr()} defaultEnd={shiftDate(todayStr(), 28)} groups={myGroups} />

      {active.length === 0 && ended.length === 0 ? (
        <EmptyState title="No challenges yet" hint="Create the first one — 28 days of hitting protein is a classic." />
      ) : (
        <>
          <div className="space-y-2">{active.map(renderRow)}</div>
          {ended.length > 0 && (
            <>
              <h2 className="pt-2 text-sm font-semibold text-ink-dim">Ended</h2>
              <div className="space-y-2">{ended.map(renderRow)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
