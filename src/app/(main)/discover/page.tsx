import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listRecipes, getSuggestedUsers } from "@/lib/queries";
import { RecipeCard } from "@/components/RecipeCard";
import { Card, UserChip, btnGhost } from "@/components/ui";
import { toggleFollow } from "@/actions/social";

export const metadata = { title: "Discover" };

function Shelf({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-accent hover:underline">
            See all →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  const [trending, highProtein, fresh, creators] = await Promise.all([
    listRecipes({ sort: "hot", limit: 6 }),
    listRecipes({ sort: "protein", limit: 6 }),
    listRecipes({ sort: "new", limit: 6 }),
    user ? getSuggestedUsers(user.id, 6) : Promise.resolve([]),
  ]);

  // "Fits your remaining macros" would filter by today's remaining targets — Phase 2 of the tracker.
  return (
    <div className="space-y-8">
      <h1 className="text-lg font-bold">Discover</h1>

      <Shelf title="🔥 Trending recipes" href="/recipes?sort=hot">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {trending.map(({ recipe, username, displayName }) => (
            <RecipeCard key={recipe.id} recipe={recipe} authorName={displayName} authorUsername={username} />
          ))}
        </div>
      </Shelf>

      <Shelf title="🍗 Best protein per calorie" href="/recipes?sort=protein">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {highProtein.map(({ recipe, username, displayName }) => (
            <RecipeCard key={recipe.id} recipe={recipe} authorName={displayName} authorUsername={username} />
          ))}
        </div>
      </Shelf>

      <Shelf title="✨ New this week" href="/recipes?sort=new">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fresh.map(({ recipe, username, displayName }) => (
            <RecipeCard key={recipe.id} recipe={recipe} authorName={displayName} authorUsername={username} />
          ))}
        </div>
      </Shelf>

      {creators.length > 0 && (
        <Shelf title="⭐ Creators to follow">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {creators.map(({ profile, reputation }) => (
              <Card key={profile.userId} className="flex items-center justify-between p-3">
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
              </Card>
            ))}
          </div>
        </Shelf>
      )}

      <Shelf title="Explore more">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { href: "/meal-prep", label: "🥡 Meal prep", note: "Plans and boards" },
            { href: "/restaurants", label: "🍔 Restaurants", note: "Nearby macro fits" },
            { href: "/workouts", label: "🏋️ Workouts", note: "Templates and logs" },
            { href: "/challenges", label: "🏆 Challenges", note: "Join a goal" },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="rounded-xl border border-edge bg-card p-3 text-center hover:bg-card-hover">
              <div className="text-sm font-medium text-ink-dim">{x.label}</div>
              <div className="text-[10px] text-ink-faint">{x.note}</div>
            </Link>
          ))}
        </div>
      </Shelf>
    </div>
  );
}
