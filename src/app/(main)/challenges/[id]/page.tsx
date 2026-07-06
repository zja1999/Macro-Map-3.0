import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { challenges, groups } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getLeaderboard, CHALLENGE_METRICS } from "@/lib/challenges";
import { joinChallenge, checkinChallenge } from "@/actions/groups";
import { todayStr } from "@/lib/utils";
import { Card, Badge, Avatar, btnGhost } from "@/components/ui";
import { ContainerModeration } from "@/components/ContainerModeration";

export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [challenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
  if (!challenge) notFound();
  const [group] = challenge.groupId
    ? await db.select().from(groups).where(eq(groups.id, challenge.groupId)).limit(1)
    : [];

  const board = await getLeaderboard(challenge);
  const me = board.find((b) => b.userId === user.id);
  const today = todayStr();
  const active = challenge.endsOn >= today && challenge.startsOn <= today;
  const metricInfo = CHALLENGE_METRICS.find((m) => m.key === challenge.metric);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-2">
        <h1 className="text-xl font-bold leading-tight">{challenge.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-faint">
          {group ? (
            <Link href={`/groups/${group.slug}`} className="hover:text-accent">
              👥 {group.name}
            </Link>
          ) : (
            <Badge>🌍 global</Badge>
          )}
          <Badge>{metricInfo?.label ?? challenge.metric}</Badge>
          <span>
            target: {challenge.target} {challenge.unit}
          </span>
          <span>
            {challenge.startsOn} → {challenge.endsOn}
          </span>
          {challenge.endsOn < today && <Badge tone="warn">ended</Badge>}
        </div>
        {challenge.description && <p className="text-sm text-ink-dim">{challenge.description}</p>}
        {metricInfo?.auto && (
          <p className="text-[11px] text-ink-faint">
            Auto-scored from your diary and workout logs — no check-ins needed, just keep logging.
          </p>
        )}
      </div>

      {/* my status */}
      {me ? (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              Your progress:{" "}
              <span className="font-bold tabular-nums">
                {Math.round(me.progress)}/{challenge.target}
              </span>{" "}
              <span className="text-xs text-ink-faint">{challenge.unit}</span>
              {me.completedAt && <span className="ml-2 font-semibold text-accent">🏆 Completed!</span>}
            </div>
            {challenge.metric === "custom_checkin" && active && !me.completedAt && (
              <form action={checkinChallenge}>
                <input type="hidden" name="challengeId" value={challenge.id} />
                <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black">
                  ✓ Check in today
                </button>
              </form>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-edge">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, (me.progress / challenge.target) * 100)}%` }}
            />
          </div>
        </Card>
      ) : active ? (
        <form action={joinChallenge}>
          <input type="hidden" name="challengeId" value={challenge.id} />
          <button className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-black">
            Join challenge
          </button>
        </form>
      ) : null}

      {/* leaderboard: username + progress only — never absolute intake (docs/05 §6) */}
      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Leaderboard · {board.length} participant{board.length === 1 ? "" : "s"}</h2>
        <ul className="divide-y divide-edge">
          {board.map((row, i) => (
            <li key={row.userId} className="flex items-center gap-3 py-2">
              <span className="w-5 text-center text-xs font-bold tabular-nums text-ink-faint">{i + 1}</span>
              <Link href={`/u/${row.username}`} className="flex min-w-0 flex-1 items-center gap-2">
                <Avatar name={row.displayName} size={26} />
                <span className={`truncate text-sm ${row.userId === user.id ? "font-semibold text-accent" : ""}`}>
                  {row.displayName}
                </span>
              </Link>
              <div className="flex w-32 items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, (row.progress / challenge.target) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums text-ink-dim">
                  {Math.round(row.progress)}
                  {row.completedAt && " 🏆"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {isModerator(user) && <ContainerModeration kind="challenge" id={challenge.id} />}

      <Link href="/challenges" className={btnGhost}>
        ← All challenges
      </Link>
    </div>
  );
}
