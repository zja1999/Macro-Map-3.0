import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chains, menuItems } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getRemainingMacros } from "@/lib/queries";
import { getOptionGroups } from "@/lib/restaurants";
import { todayStr, slotForNow } from "@/lib/utils";
import { BowlBuilder } from "@/components/BowlBuilder";

export const metadata = { title: "Build your order" };

export default async function BuildPage({ params }: { params: Promise<{ itemId: string }> }) {
  const user = await requireUser();
  const { itemId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(itemId)) notFound();

  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, itemId)).limit(1);
  if (!item) notFound();
  if (item.kind !== "buildable") redirect(`/restaurants/${item.chainId}`);

  const [[chain], groups, remaining] = await Promise.all([
    db.select().from(chains).where(eq(chains.id, item.chainId)).limit(1),
    getOptionGroups(item.id),
    getRemainingMacros(user.id, user.targets, todayStr()),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">
          {chain?.emoji} {item.name}
        </h1>
        <Link href={`/restaurants/${item.chainId}`} className="text-xs text-ink-faint hover:text-ink">
          ← {chain?.name}
        </Link>
      </div>
      <p className="text-xs text-ink-dim">
        Build it exactly how you&apos;d order it — the tally updates live against today&apos;s remaining macros.
      </p>
      <BowlBuilder
        menuItemId={item.id}
        itemName={item.name}
        chainName={chain?.name ?? ""}
        groups={groups}
        remaining={remaining}
        date={todayStr()}
        defaultSlot={slotForNow()}
      />
    </div>
  );
}
