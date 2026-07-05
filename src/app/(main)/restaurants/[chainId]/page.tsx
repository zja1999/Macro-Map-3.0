import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRemainingMacros } from "@/lib/queries";
import { getChainWithItems, getPopularOrders, getSavedRestaurantSubjectIds, fitLabel } from "@/lib/restaurants";
import { todayStr, slotForNow } from "@/lib/utils";
import { logMenuItem, logGoToOrder, toggleRestaurantSave } from "@/actions/restaurants";
import { Card, Badge } from "@/components/ui";
import { MacroPills } from "@/components/macros";

export default async function ChainPage({ params }: { params: Promise<{ chainId: string }> }) {
  const user = await requireUser();
  const { chainId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(chainId)) notFound();

  const [data, orders, remaining, savedIds] = await Promise.all([
    getChainWithItems(chainId),
    getPopularOrders(chainId),
    getRemainingMacros(user.id, user.targets, todayStr()),
    getSavedRestaurantSubjectIds(user.id),
  ]);
  if (!data) notFound();
  const { chain, items } = data;

  const date = todayStr();
  const slot = slotForNow();
  const byCategory = new Map<string, typeof items>();
  for (const i of items) {
    const cat = i.category ?? "Menu";
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), i]);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">
          {chain.emoji} {chain.name}
          {chain.verified && <span className="ml-1.5 text-sm text-accent" title="Verified nutrition data">✓</span>}
        </h1>
        <Link href="/restaurants" className="text-xs text-ink-faint hover:text-ink">
          ← Around me
        </Link>
      </div>

      {remaining?.logged && remaining.calories > 150 && (
        <p className="text-[11px] text-ink-faint">
          You have <span className="font-semibold text-ink-dim">{Math.round(remaining.calories)} kcal</span> ·{" "}
          <span className="font-semibold text-protein">{Math.max(0, Math.round(remaining.proteinG))}g protein</span>{" "}
          left today.
        </p>
      )}

      {/* popular builds — community answer to "what should I actually get here" */}
      {orders.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-dim">🔥 Popular orders here</h2>
          {orders.map(({ order, username, displayName }) => (
            <Card key={order.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{order.name}</div>
                <div className="text-[11px] text-ink-faint">
                  by{" "}
                  <Link href={`/u/${username}`} className="hover:text-accent">
                    {displayName}
                  </Link>
                  {order.logCount > 0 && ` · logged ${order.logCount}×`}
                </div>
                <div className="mt-1">
                  <MacroPills calories={order.calories} proteinG={order.proteinG} carbsG={order.carbsG} fatG={order.fatG} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <form action={toggleRestaurantSave}>
                  <input type="hidden" name="subjectType" value="go_to_order" />
                  <input type="hidden" name="subjectId" value={order.id} />
                  <input type="hidden" name="path" value={`/restaurants/${chainId}`} />
                  <button
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                      savedIds.has(`go_to_order:${order.id}`)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-edge bg-card text-ink-dim hover:text-ink"
                    }`}
                  >
                    {savedIds.has(`go_to_order:${order.id}`) ? "Saved" : "Save"}
                  </button>
                </form>
                <form action={logGoToOrder}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="logDate" value={date} />
                  <input type="hidden" name="mealSlot" value={slot} />
                  <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Log</button>
                </form>
              </div>
            </Card>
          ))}
        </section>
      )}

      {[...byCategory.entries()].map(([category, catItems]) => (
        <section key={category} className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-dim">{category}</h2>
          {catItems.map((item) => {
            const per100 = item.calories > 0 ? (item.proteinG * 100) / item.calories : 0;
            const label = fitLabel(item, remaining);
            return (
              <Card key={item.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {item.name}
                    {item.kind === "buildable" && <Badge tone="accent">build your own</Badge>}
                    {per100 >= 8 && item.kind !== "buildable" && (
                      <span className="ml-1.5 text-[10px] font-semibold text-protein">
                        {per100.toFixed(1)}g P / 100 kcal
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <MacroPills calories={item.calories} proteinG={item.proteinG} carbsG={item.carbsG} fatG={item.fatG} />
                  </div>
                  {item.kind === "buildable" && (
                    <div className="mt-0.5 text-[10px] text-ink-faint">macros shown are the default build</div>
                  )}
                  {label && item.kind !== "buildable" && (
                    <div className="mt-1 text-[10px] font-medium text-accent">✓ {label}</div>
                  )}
                  {(item.sodiumMg ?? 0) > 920 && <div className="mt-0.5 text-[10px] text-carbs">⚠ high sodium</div>}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <form action={toggleRestaurantSave}>
                    <input type="hidden" name="subjectType" value="menu_item" />
                    <input type="hidden" name="subjectId" value={item.id} />
                    <input type="hidden" name="path" value={`/restaurants/${chainId}`} />
                    <button
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        savedIds.has(`menu_item:${item.id}`)
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-edge bg-card text-ink-dim hover:text-ink"
                      }`}
                    >
                      {savedIds.has(`menu_item:${item.id}`) ? "Saved" : "Save"}
                    </button>
                  </form>
                  {item.kind === "buildable" ? (
                    <Link
                      href={`/restaurants/build/${item.id}`}
                      className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black"
                    >
                      Build →
                    </Link>
                  ) : (
                    <form action={logMenuItem}>
                      <input type="hidden" name="menuItemId" value={item.id} />
                      <input type="hidden" name="logDate" value={date} />
                      <input type="hidden" name="mealSlot" value={slot} />
                      <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Log</button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}
