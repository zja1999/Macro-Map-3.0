import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listWorkouts, getSavedWorkouts, getRecentWorkoutLogs, getMyPrs, prLabel, workoutLogSummary } from "@/lib/workouts";
import { sharePr } from "@/actions/workouts";
import { timeAgo } from "@/lib/utils";
import { Card, EmptyState, btnPrimary, btnGhost } from "@/components/ui";
import { ReviewNudge } from "@/components/ReviewNudge";

export const metadata = { title: "Workouts" };

export default async function WorkoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; logged?: string; prs?: string }>;
}) {
  const user = await getCurrentUser();
  const sp = await searchParams;
  const units = (user?.profile.units ?? "imperial") as "metric" | "imperial";
  let tab = sp.tab === "templates" ? "templates" : sp.tab === "saved" ? "saved" : "community";
  if (!user && tab === "saved") tab = "community";

  const rows =
    tab === "saved" && user
      ? await getSavedWorkouts(user.id)
      : await listWorkouts({ scope: tab === "templates" ? "templates" : "community" });
  const { logs, exerciseById } = user
    ? await getRecentWorkoutLogs(user.id, 5)
    : { logs: [] as Awaited<ReturnType<typeof getRecentWorkoutLogs>>["logs"], exerciseById: new Map() };
  const prRows = user ? await getMyPrs(user.id) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">Workouts</h1>
        {user && (
          <div className="flex gap-2">
            <Link href="/workouts/log" className={btnPrimary}>
              Log session
            </Link>
            <Link href="/workouts/new" className={btnGhost}>
              + Create
            </Link>
          </div>
        )}
      </div>

      {sp.prs && <ReviewNudge moment={`pr-${sp.prs}`} />}

      {sp.logged && (
        <Card className={`p-3 ${sp.prs ? "border-accent/50 bg-accent/10" : ""}`}>
          {sp.prs ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-accent">New personal record{sp.prs.includes(" · ") ? "s" : ""}!</div>
              <div className="text-xs text-ink-dim">{sp.prs}</div>
              <form action={sharePr} className="flex gap-2">
                <input type="hidden" name="body" value={`New PR - ${sp.prs}`.slice(0, 300)} />
                <button className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-black">Share to feed</button>
                <Link href="/workouts" className="rounded-lg border border-edge px-3 py-1.5 text-xs text-ink-dim">
                  Keep it private
                </Link>
              </form>
            </div>
          ) : (
            <div className="text-sm text-ink-dim">Session logged. No PRs this time; the work still counts.</div>
          )}
        </Card>
      )}

      <div className="flex gap-1 rounded-lg border border-edge bg-card p-1 text-xs">
        {(
          [
            ["community", "Community"],
            ["templates", "Templates"],
            ["saved", "Saved"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/workouts?tab=${key}`}
            className={`flex-1 rounded-md px-2 py-1.5 text-center font-medium ${tab === key ? "bg-accent text-black" : "text-ink-dim"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={tab === "saved" ? "No saved workouts yet" : "Nothing here yet"}
          hint="Save community workouts to build your rotation, or publish your own."
        />
      ) : (
        <div className="space-y-2">
          {rows.map(({ workout, username, displayName }) => (
            <Card key={workout.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/workouts/${workout.id}`} className="text-sm font-medium hover:text-accent">
                    {workout.title}
                    {workout.isTemplate && <span className="ml-1.5 text-[10px] font-semibold text-accent">OFFICIAL</span>}
                  </Link>
                  <div className="mt-0.5 text-[11px] text-ink-faint">
                    {workout.isTemplate ? "Starter template" : displayName ? (
                      <Link href={`/u/${username}`} className="hover:text-accent">
                        {displayName}
                      </Link>
                    ) : "Community"}
                    {" · "}
                    <span className="capitalize">{workout.kind}</span>
                    {workout.estDurationMin && ` · ~${workout.estDurationMin} min`}
                    {" · "}
                    {workout.structure.length} movement{workout.structure.length === 1 ? "" : "s"}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-dim">
                    {!workout.isTemplate && workout.upvotes - workout.downvotes !== 0 && (
                      <span className="mr-2 font-semibold text-accent">▲ {workout.upvotes - workout.downvotes}</span>
                    )}
                    {workout.completedCount > 0 && <span className="mr-2">completed {workout.completedCount}x</span>}
                    {workout.saveCount > 0 && <span>saved {workout.saveCount}</span>}
                  </div>
                </div>
                <Link
                  href={`/workouts/log?from=${workout.id}`}
                  className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black"
                >
                  Start
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Recent sessions</h2>
          <ul className="divide-y divide-edge">
            {logs.map((l) => (
              <li key={l.id} className="py-1.5 text-xs">
                <span className="text-ink-faint">{timeAgo(l.performedAt)}</span>
                <span className="ml-2 text-ink-dim">{workoutLogSummary(l.entries, exerciseById, units)}</span>
                {l.durationMin && <span className="ml-2 text-ink-faint">({l.durationMin} min)</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {prRows.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Your PRs</h2>
          <div className="flex flex-wrap gap-2">
            {prRows.slice(0, 12).map(({ pr, exerciseName }) => (
              <div key={pr.id} className="rounded-lg bg-surface px-3 py-2 text-center">
                <div className="text-xs font-bold tabular-nums">{prLabel(pr, units)}</div>
                <div className="text-[10px] text-ink-faint">{exerciseName}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
