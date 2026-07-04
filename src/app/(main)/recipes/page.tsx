import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { listRecipes, getSavedRecipes, type RecipeSort } from "@/lib/queries";
import { RECIPE_TAGS } from "@/lib/utils";
import { RecipeCard } from "@/components/RecipeCard";
import { EmptyState, inputCls, btnPrimary } from "@/components/ui";

export const metadata = { title: "Recipes" };

const SORTS: { key: RecipeSort; label: string }[] = [
  { key: "hot", label: "🔥 Hot" },
  { key: "top", label: "▲ Top" },
  { key: "new", label: "✨ New" },
  { key: "protein", label: "🍗 Protein/kcal" },
];

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; view?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const sp = await searchParams;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key ?? "hot") as RecipeSort;
  const tag = RECIPE_TAGS.includes((sp.tag ?? "") as (typeof RECIPE_TAGS)[number]) ? sp.tag : undefined;
  const q = (sp.q ?? "").slice(0, 60);
  const view = sp.view === "saved" ? "saved" : "all";

  const rows =
    view === "saved"
      ? await getSavedRecipes(user.id)
      : await listRecipes({ q: q || undefined, tag, sort });

  const qs = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q, tag, sort, view, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return `/recipes?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Community recipes</h1>
        <Link href="/recipes/new" className={btnPrimary}>
          + Submit
        </Link>
      </div>

      <form className="flex gap-2">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <input type="hidden" name="sort" value={sort} />
        <input name="q" defaultValue={q} placeholder="Search recipes…" className={inputCls} />
        <button className={btnPrimary}>Search</button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={qs({ sort: s.key, view: undefined })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              sort === s.key && view === "all"
                ? "border-accent bg-accent/15 text-accent"
                : "border-edge bg-card text-ink-dim hover:bg-card-hover"
            }`}
          >
            {s.label}
          </Link>
        ))}
        <Link
          href={qs({ view: view === "saved" ? undefined : "saved" })}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            view === "saved" ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim hover:bg-card-hover"
          }`}
        >
          🔖 Saved
        </Link>
      </div>

      <div className="flex flex-wrap gap-1">
        {RECIPE_TAGS.map((t) => (
          <Link
            key={t}
            href={qs({ tag: tag === t ? undefined : t, view: undefined })}
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              tag === t ? "bg-accent text-black font-semibold" : "bg-surface text-ink-faint hover:text-ink"
            }`}
          >
            #{t}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={view === "saved" ? "No saved recipes yet" : "No recipes match"}
          hint={view === "saved" ? "Tap 🔖 Save on any recipe to keep it here." : "Try a different search or tag."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ recipe, username, displayName }) => (
            <RecipeCard key={recipe.id} recipe={recipe} authorName={displayName} authorUsername={username} />
          ))}
        </div>
      )}
    </div>
  );
}
