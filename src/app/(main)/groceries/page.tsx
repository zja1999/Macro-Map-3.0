import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groceryItems, groceryLists, recipes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { addGroceryItem, toggleGroceryItem, deleteGroceryItem, clearPurchased } from "@/actions/groceries";
import { Card, EmptyState, inputCls, btnGhost } from "@/components/ui";

export const metadata = { title: "Groceries" };

const SECTION_ORDER = ["produce", "protein", "dairy", "pantry", "frozen", "other"];
const SECTION_EMOJI: Record<string, string> = {
  produce: "🥬",
  protein: "🍗",
  dairy: "🥛",
  pantry: "🥫",
  frozen: "🧊",
  other: "🛒",
};

export default async function GroceriesPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string }>;
}) {
  const user = (await getCurrentUser())!;
  const { added } = await searchParams;

  const [list] = await db.select().from(groceryLists).where(eq(groceryLists.userId, user.id)).limit(1);
  const items = list
    ? await db
        .select({ item: groceryItems, recipeName: recipes.name })
        .from(groceryItems)
        .leftJoin(recipes, eq(recipes.id, groceryItems.sourceRecipeId))
        .where(eq(groceryItems.listId, list.id))
        .orderBy(asc(groceryItems.purchased), asc(groceryItems.createdAt))
    : [];

  const bySection = new Map<string, typeof items>();
  for (const row of items) {
    const s = row.item.section && SECTION_ORDER.includes(row.item.section) ? row.item.section : "other";
    bySection.set(s, [...(bySection.get(s) ?? []), row]);
  }
  const remaining = items.filter((i) => !i.item.purchased).length;
  const estCost = items.reduce((a, i) => a + (i.item.purchased ? 0 : (i.item.estCostCents ?? 0)), 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-bold">🛒 Groceries</h1>
        <span className="text-xs text-ink-faint">
          {remaining} to buy{estCost > 0 && ` · ~$${(estCost / 100).toFixed(2)}`}
        </span>
      </div>

      {added && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs text-accent">
          ✓ Ingredients added — duplicates merged into existing items.
        </p>
      )}

      <form action={addGroceryItem} className="flex gap-2">
        <input name="name" required maxLength={80} placeholder="Add an item…" className={inputCls} />
        <input name="quantity" maxLength={30} placeholder="qty" className={`${inputCls} w-24`} />
        <button className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-black">Add</button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="List is empty"
          hint="Add items above, or open any recipe / meal prep plan and tap “Add to groceries” — ingredients merge and sort by store section."
          action={
            <Link href="/recipes" className={btnGhost}>
              Browse recipes
            </Link>
          }
        />
      ) : (
        SECTION_ORDER.filter((s) => bySection.has(s)).map((section) => (
          <Card key={section} className="p-3">
            <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              {SECTION_EMOJI[section]} {section}
            </h2>
            <ul className="divide-y divide-edge">
              {bySection.get(section)!.map(({ item, recipeName }) => (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <form action={toggleGroceryItem} className="flex min-w-0 flex-1 items-center gap-2.5">
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] ${
                        item.purchased ? "border-accent bg-accent text-black" : "border-edge"
                      }`}
                      aria-label={item.purchased ? "Mark as not purchased" : "Mark as purchased"}
                    >
                      {item.purchased ? "✓" : ""}
                    </button>
                    <span className={`min-w-0 flex-1 truncate text-left text-sm ${item.purchased ? "text-ink-faint line-through" : ""}`}>
                      {item.name}
                      {item.quantity && <span className="ml-1.5 text-xs text-ink-faint">{item.quantity}</span>}
                    </span>
                  </form>
                  {recipeName && (
                    <span className="max-w-24 shrink-0 truncate text-[10px] text-ink-faint" title={`From ${recipeName}`}>
                      {recipeName}
                    </span>
                  )}
                  <form action={deleteGroceryItem} className="shrink-0">
                    <input type="hidden" name="id" value={item.id} />
                    <button className="px-1 text-ink-faint hover:text-danger" aria-label="Remove">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}

      {items.some((i) => i.item.purchased) && (
        <form action={clearPurchased} className="text-center">
          <button className="text-xs text-ink-faint hover:text-danger">Clear purchased items</button>
        </form>
      )}
    </div>
  );
}
