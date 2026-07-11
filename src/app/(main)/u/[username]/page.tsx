import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Settings, Shield, ShoppingCart, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { isModerator } from "@/lib/permissions";
import { getProfileByUsername, getFollowStats, getUserPosts, listRecipes, getFollowList } from "@/lib/queries";
import { getUserWorkouts } from "@/lib/workouts";
import { toggleFollow } from "@/actions/social";
import { logout } from "@/actions/auth";
import { Avatar, Badge, Card, UserChip, btnPrimary, btnGhost, EmptyState } from "@/components/ui";
import { PostCard } from "@/components/PostCard";
import { RecipeCard } from "@/components/RecipeCard";
import { ReportButton } from "@/components/ReportButton";

function UtilityRow({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:bg-surface-3">
      <Icon size={18} strokeWidth={1.8} className="text-text-secondary" />
      {label}
      <ChevronRight size={15} className="ml-auto text-text-tertiary" />
    </Link>
  );
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const viewer = await requireUser();
  const { username } = await params;
  const { tab } = await searchParams;

  const row = await getProfileByUsername(username);
  if (!row) notFound();
  const { profile, reputation } = row;
  const isMe = profile.userId === viewer.id;
  const canModerate = isModerator(viewer);
  const stats = await getFollowStats(profile.userId, viewer.id);
  const activeTab =
    tab === "recipes" || tab === "workouts" || tab === "followers" || tab === "following" ? tab : "posts";

  const posts = activeTab === "posts" ? await getUserPosts(viewer.id, profile.userId) : [];
  const recipes = activeTab === "recipes" ? await listRecipes({ authorId: profile.userId, sort: "new" }) : [];
  const workouts = activeTab === "workouts" ? await getUserWorkouts(profile.userId) : [];
  const followList =
    activeTab === "followers" || activeTab === "following"
      ? await getFollowList(profile.userId, activeTab)
      : [];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile.displayName} size={56} src={profile.avatarUrl} />
            <div>
              <h1 className="text-lg font-bold leading-tight">{profile.displayName}</h1>
              <div className="text-xs text-ink-faint">@{profile.username}</div>
            </div>
          </div>
          {isMe ? (
            <div className="flex gap-2">
              <Link href="/settings" className={btnGhost}>
                Edit
              </Link>
              <form action={logout}>
                <button className={btnGhost}>Sign out</button>
              </form>
            </div>
          ) : (
            <form action={toggleFollow}>
              <input type="hidden" name="userId" value={profile.userId} />
              <input type="hidden" name="username" value={profile.username} />
              <button className={stats.isFollowing ? btnGhost : btnPrimary}>
                {stats.isFollowing ? "Following ✓" : "Follow"}
              </button>
            </form>
          )}
        </div>

        {profile.bio && <p className="text-sm text-ink-dim">{profile.bio}</p>}

        <div className="flex flex-wrap gap-1.5">
          {profile.goal && <Badge tone="accent">{profile.goal.replace("_", " ")}</Badge>}
          {profile.trackingStyle && <Badge>{profile.trackingStyle.replace(/_/g, " ")}</Badge>}
          {profile.dietaryStyle && <Badge>{profile.dietaryStyle}</Badge>}
          <Badge tone="good">⭐ {reputation} rep</Badge>
        </div>

        <div className="flex gap-5 text-sm">
          <Link href={`/u/${profile.username}?tab=followers`} className="hover:text-accent">
            <span className="font-bold">{stats.followers}</span>{" "}
            <span className="text-ink-faint">followers</span>
          </Link>
          <Link href={`/u/${profile.username}?tab=following`} className="hover:text-accent">
            <span className="font-bold">{stats.following}</span>{" "}
            <span className="text-ink-faint">following</span>
          </Link>
        </div>

        {!isMe && (
          <div className="border-t border-edge pt-3">
            <ReportButton subjectType="user" subjectId={profile.userId} label="Report account" />
          </div>
        )}
      </Card>

      {/* You-tab utility surfaces (plan §2.1): destinations without tab-bar
          slots get their mobile path here. */}
      {isMe && (
        <Card className="divide-y divide-border">
          <UtilityRow href="/groceries" icon={ShoppingCart} label="Groceries" />
          <UtilityRow href="/settings" icon={Settings} label="Settings" />
          {canModerate && <UtilityRow href="/admin" icon={Shield} label="Admin" />}
        </Card>
      )}

      <div className="flex gap-1 rounded-lg border border-edge bg-card p-1">
        {[
          { key: "posts", label: "Posts" },
          { key: "recipes", label: "Recipes" },
          { key: "workouts", label: "Workouts" },
          { key: "followers", label: "Followers" },
          { key: "following", label: "Following" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/u/${profile.username}${t.key === "posts" ? "" : `?tab=${t.key}`}`}
            className={`flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium ${
              activeTab === t.key ? "bg-accent text-black" : "text-ink-dim"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "posts" &&
        (posts.length === 0 ? (
          <EmptyState title="No posts yet" />
        ) : (
          posts.map((item) => <PostCard key={item.post.id} item={item} canModerate={canModerate} moderationPath={`/u/${profile.username}`} />)
        ))}

      {activeTab === "recipes" &&
        (recipes.length === 0 ? (
          <EmptyState title="No recipes published yet" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recipes.map(({ recipe, username: u, displayName }) => (
              <RecipeCard key={recipe.id} recipe={recipe} authorName={displayName} authorUsername={u} />
            ))}
          </div>
        ))}

      {activeTab === "workouts" &&
        (workouts.length === 0 ? (
          <EmptyState title="No workouts published yet" />
        ) : (
          <div className="space-y-2">
            {workouts.map(({ workout }) => {
              const net = workout.upvotes - workout.downvotes;
              return (
                <Card key={workout.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link href={`/workouts/${workout.id}`} className="text-sm font-medium hover:text-accent">
                      {workout.title}
                    </Link>
                    <div className="mt-0.5 text-[11px] text-ink-faint">
                      <span className="capitalize">{workout.kind}</span>
                      {" · "}
                      {workout.structure.length} movement{workout.structure.length === 1 ? "" : "s"}
                      {workout.completedCount > 0 && ` · completed ${workout.completedCount}x`}
                    </div>
                  </div>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${net > 0 ? "text-accent" : "text-ink-dim"}`}>
                    ▲ {net}
                  </span>
                </Card>
              );
            })}
          </div>
        ))}

      {(activeTab === "followers" || activeTab === "following") &&
        (followList.length === 0 ? (
          <EmptyState title={activeTab === "followers" ? "No followers yet" : "Not following anyone yet"} />
        ) : (
          <div className="space-y-2">
            {followList.map(({ profile: p, reputation }) => (
              <Card key={p.userId} className="flex items-center justify-between p-3">
                <UserChip username={p.username} displayName={p.displayName} avatarUrl={p.avatarUrl} sub={`${reputation} rep`} />
                <Link href={`/u/${p.username}`} className={btnGhost}>
                  View
                </Link>
              </Card>
            ))}
          </div>
        ))}
    </div>
  );
}
