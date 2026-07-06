import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getFeed, getSuggestedUsers, getDayLogs, getStreak } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { DashboardHero } from "@/components/DashboardHero";
import { EmptyState, UserChip, Card, btnGhost } from "@/components/ui";
import { toggleFollow } from "@/actions/social";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const scope = tab === "trending" ? "trending" : "following";
  const today = todayStr();
  const [feed, suggested, day, streak] = await Promise.all([
    getFeed(user.id, scope),
    getSuggestedUsers(user.id, 4),
    getDayLogs(user.id, today),
    getStreak(user.id, today),
  ]);
  const canModerate = isModerator(user);

  const consumed = day.logs.reduce(
    (a, l) => ({
      calories: a.calories + l.calories,
      protein: a.protein + l.proteinG,
      carbs: a.carbs + l.carbsG,
      fat: a.fat + l.fatG,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DashboardHero
        name={user.profile.displayName}
        consumed={consumed}
        targets={user.targets}
        streak={streak}
        mealsLogged={day.logs.length}
      />

      <div className="flex gap-1 rounded-lg border border-edge bg-card p-1">
        {[
          { key: "following", label: "Following" },
          { key: "trending", label: "Trending" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.key === "following" ? "/" : "/?tab=trending"}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium transition ${
              scope === t.key ? "bg-accent text-black" : "text-ink-dim hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <PostComposer />

      {suggested.length > 0 && scope === "following" && (
        <Card className="space-y-3 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Suggested to follow</h3>
          {suggested.map(({ profile, reputation }) => (
            <div key={profile.userId} className="flex items-center justify-between">
              <UserChip
                username={profile.username}
                displayName={profile.displayName}
                sub={`${reputation} rep${profile.goal ? ` · ${profile.goal.replace("_", " ")}` : ""}`}
              />
              <form action={toggleFollow}>
                <input type="hidden" name="userId" value={profile.userId} />
                <input type="hidden" name="username" value={profile.username} />
                <button className={btnGhost}>Follow</button>
              </form>
            </div>
          ))}
        </Card>
      )}

      {feed.length === 0 ? (
        <EmptyState
          title={scope === "following" ? "Your feed is quiet" : "Nothing trending yet"}
          hint="Follow some creators or check the trending tab to see what the community is cooking."
          action={
            <Link href="/?tab=trending" className={btnGhost}>
              See trending
            </Link>
          }
        />
      ) : (
        feed.map((item) => <PostCard key={item.post.id} item={item} canModerate={canModerate} moderationPath="/" />)
      )}
    </div>
  );
}
