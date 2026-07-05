import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfileByUsername, getFollowStats, getUserPosts, listRecipes } from "@/lib/queries";
import { toggleFollow } from "@/actions/social";
import { logout } from "@/actions/auth";
import { Avatar, Badge, Card, btnPrimary, btnGhost, EmptyState } from "@/components/ui";
import { PostCard } from "@/components/PostCard";
import { RecipeCard } from "@/components/RecipeCard";

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
  const stats = await getFollowStats(profile.userId, viewer.id);
  const activeTab = tab === "recipes" ? "recipes" : "posts";

  const posts = activeTab === "posts" ? await getUserPosts(viewer.id, profile.userId) : [];
  const recipes = activeTab === "recipes" ? await listRecipes({ authorId: profile.userId, sort: "new" }) : [];

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={profile.displayName} size={56} />
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
          <span>
            <span className="font-bold">{stats.followers}</span>{" "}
            <span className="text-ink-faint">followers</span>
          </span>
          <span>
            <span className="font-bold">{stats.following}</span>{" "}
            <span className="text-ink-faint">following</span>
          </span>
        </div>
      </Card>

      <div className="flex gap-1 rounded-lg border border-edge bg-card p-1">
        {[
          { key: "posts", label: "Posts" },
          { key: "recipes", label: "Recipes" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/u/${profile.username}${t.key === "recipes" ? "?tab=recipes" : ""}`}
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
          posts.map((item) => <PostCard key={item.post.id} item={item} />)
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
    </div>
  );
}
