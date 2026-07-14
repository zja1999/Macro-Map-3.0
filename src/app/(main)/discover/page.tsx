import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ChefHat, Dumbbell, Package, Users } from "lucide-react";
import { db } from "@/db/client";
import { mealPrepPlans, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getSuggestedUsers, listRecipes } from "@/lib/queries";
import { listWorkouts } from "@/lib/workouts";
import { Card, UserChip, btnGhost } from "@/components/ui";
import { toggleFollow } from "@/actions/social";

export const metadata = { title: "Discover" };

function Shelf({ title, note, href, children }: { title: string; note: string; href: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold">{title}</h2>
          <p className="truncate text-[11px] text-ink-faint">{note}</p>
        </div>
        <Link href={href} className="shrink-0 text-xs font-semibold text-accent">See all</Link>
      </div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </section>
  );
}

function RecommendationCard({ href, image, icon, eyebrow, title, meta }: { href: string; image?: string | null; icon: React.ReactNode; eyebrow: string; title: string; meta: string }) {
  return (
    <Link href={href} className="min-w-0 overflow-hidden rounded-xl border border-edge bg-card transition active:scale-[0.98] hover:border-accent/40">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="aspect-[2/1] w-full object-cover" />
      ) : (
        <div className="flex h-12 items-center bg-gradient-to-br from-accent/15 to-surface-2 px-3 text-accent">{icon}</div>
      )}
      <div className="min-w-0 space-y-1 p-2.5">
        <div className="text-[9px] font-bold uppercase tracking-wider text-accent">{eyebrow}</div>
        <h3 className="line-clamp-2 [overflow-wrap:anywhere] text-xs font-semibold leading-snug">{title}</h3>
        <p className="line-clamp-1 text-[10px] text-ink-faint">{meta}</p>
      </div>
    </Link>
  );
}

export default async function DiscoverPage() {
  const user = await getCurrentUser();
  const [recipes, workouts, plans, creators] = await Promise.all([
    listRecipes({ sort: "hot", limit: 4 }),
    listWorkouts({ scope: "community", limit: 4 }),
    db
      .select({ plan: mealPrepPlans, username: profiles.username })
      .from(mealPrepPlans)
      .innerJoin(profiles, eq(profiles.userId, mealPrepPlans.authorId))
      .where(eq(mealPrepPlans.status, "published"))
      .orderBy(desc(sql`(${mealPrepPlans.upvotes} - ${mealPrepPlans.downvotes}) * 3 + ${mealPrepPlans.saveCount} * 2`))
      .limit(4),
    user ? getSuggestedUsers(user.id, 4) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold">Discover</h1>
        <p className="text-xs text-ink-faint">Fresh ideas for eating, training, and planning your week.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { href: "/recipes", label: "Recipes", icon: ChefHat },
          { href: "/workouts", label: "Workouts", icon: Dumbbell },
          { href: "/meal-prep", label: "Meal prep", icon: Package },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-edge bg-card text-xs font-semibold text-ink-dim active:scale-[0.98] hover:border-accent/40 hover:text-accent">
            <Icon size={17} strokeWidth={1.9} />
            {label}
          </Link>
        ))}
      </div>

      <Shelf title="Cook something" note="Popular recipes from the community" href="/recipes?sort=hot">
        {recipes.map(({ recipe, username }) => (
          <RecommendationCard key={recipe.id} href={`/recipes/${recipe.id}`} image={recipe.coverImageUrl} icon={<ChefHat size={17} />} eyebrow="Recipe" title={recipe.name} meta={`${Math.round(recipe.calories)} kcal · ${Math.round(recipe.proteinG)}g protein · @${username}`} />
        ))}
      </Shelf>

      <Shelf title="Train next" note="Community workouts worth trying" href="/workouts">
        {workouts.map(({ workout, username }) => (
          <RecommendationCard key={workout.id} href={`/workouts/${workout.id}`} icon={<Dumbbell size={17} />} eyebrow={workout.kind} title={workout.title} meta={`${workout.structure.length} movements${workout.estDurationMin ? ` · ${workout.estDurationMin} min` : ""}${username ? ` · @${username}` : ""}`} />
        ))}
      </Shelf>

      <Shelf title="Prep the week" note="Plans that make the next few days easier" href="/meal-prep">
        {plans.map(({ plan, username }) => (
          <RecommendationCard key={plan.id} href={`/meal-prep/${plan.id}`} image={plan.coverImageUrl} icon={<Package size={17} />} eyebrow="Meal prep" title={plan.title} meta={`${plan.totalServings} servings${plan.daysCovered ? ` · ${plan.daysCovered} days` : ""} · @${username}`} />
        ))}
      </Shelf>

      {creators.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2"><Users size={15} className="text-accent" /><h2 className="text-sm font-bold">People you interact with</h2></div>
          <div className="grid gap-2 sm:grid-cols-2">
            {creators.map(({ profile }) => (
              <Card key={profile.userId} className="flex min-w-0 items-center justify-between gap-2 p-3">
                <UserChip username={profile.username} displayName={profile.displayName} avatarUrl={profile.avatarUrl} sub={profile.goal ? profile.goal.replace("_", " ") : "Interaction-based match"} />
                <form action={toggleFollow} className="shrink-0">
                  <input type="hidden" name="userId" value={profile.userId} />
                  <input type="hidden" name="username" value={profile.username} />
                  <button className={btnGhost}>Follow</button>
                </form>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
