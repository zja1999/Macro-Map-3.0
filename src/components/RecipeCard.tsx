import Link from "next/link";
import { recipes } from "@/db/schema";
import { MacroPills, ProvenanceBadge } from "./macros";
import { Badge } from "./ui";

const CARD_HUES = ["from-lime-900/40", "from-sky-900/40", "from-amber-900/40", "from-rose-900/40", "from-emerald-900/40"];

export function RecipeCard({
  recipe,
  authorName,
  authorUsername,
  compact = false,
}: {
  recipe: typeof recipes.$inferSelect;
  authorName: string;
  authorUsername: string;
  compact?: boolean;
}) {
  const hue = CARD_HUES[recipe.name.length % CARD_HUES.length];
  const net = recipe.upvotes - recipe.downvotes;
  const rating = recipe.ratingCount > 0 ? (recipe.ratingSum / recipe.ratingCount).toFixed(1) : null;
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="block overflow-hidden rounded-xl border border-edge bg-card transition hover:border-accent/40 hover:bg-card-hover"
    >
      {!compact && (
        <div className={`flex h-24 items-end bg-gradient-to-br ${hue} to-card p-3`}>
          <span className="text-3xl">🍽️</span>
        </div>
      )}
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{recipe.name}</h3>
          <span className={`shrink-0 text-xs font-bold tabular-nums ${net > 0 ? "text-accent" : "text-ink-faint"}`}>
            ▲ {net}
          </span>
        </div>
        <MacroPills calories={recipe.calories} proteinG={recipe.proteinG} carbsG={recipe.carbsG} fatG={recipe.fatG} />
        <div className="flex flex-wrap items-center gap-1.5">
          <ProvenanceBadge source={recipe.macroSource} confidence={recipe.macroConfidence} />
          {rating && <Badge>★ {rating}</Badge>}
          {recipe.logCount > 0 && <Badge>logged {recipe.logCount}×</Badge>}
        </div>
        <div className="text-[11px] text-ink-faint">
          by {authorName} · @{authorUsername}
          {recipe.prepMin != null && ` · ${(recipe.prepMin ?? 0) + (recipe.cookMin ?? 0)} min`}
          {recipe.costCents != null && ` · $${(recipe.costCents / 100).toFixed(2)}/serv`}
        </div>
      </div>
    </Link>
  );
}
