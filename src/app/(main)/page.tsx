import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getFeed, getDayLogs, getStreak } from "@/lib/queries";
import { todayStr } from "@/lib/utils";
import { PostCard } from "@/components/PostCard";
import { PostComposer } from "@/components/PostComposer";
import { DashboardHero } from "@/components/DashboardHero";
import { EmptyState, btnGhost } from "@/components/ui";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const { tab } = await searchParams;
  const scope = tab === "trending" ? "trending" : "following";
  const today = todayStr();
  const [feed, day, streak] = await Promise.all([
    getFeed(user.id, scope),
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
