import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chains, menuItems } from "@/db/schema";
import { requireMacroTrayUser } from "@/lib/macrotray";
import { getRemainingMacros } from "@/lib/queries";
import { getOptionGroups } from "@/lib/restaurants";
import { slotForNow, todayStr } from "@/lib/utils";
import { BowlBuilder } from "@/components/BowlBuilder";

export default async function MacroTrayBuildPage({ params }: { params: Promise<{ itemId: string }> }) {
  const user = await requireMacroTrayUser();
  const { itemId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(itemId)) notFound();
  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, itemId)).limit(1);
  if (!item) notFound();
  if (item.kind !== "buildable") redirect("/macrotray/restaurants");
  const [[chain], groups, remaining] = await Promise.all([db.select().from(chains).where(eq(chains.id, item.chainId)).limit(1), getOptionGroups(item.id), getRemainingMacros(user.id, user.targets, todayStr())]);
  return <div className="space-y-3"><div className="flex items-center justify-between"><h1 className="text-base font-bold">{chain?.emoji} {item.name}</h1><Link href="/macrotray/restaurants" className="text-xs text-accent">Restaurants</Link></div><BowlBuilder menuItemId={item.id} itemName={item.name} chainName={chain?.name ?? ""} groups={groups} remaining={remaining} date={todayStr()} defaultSlot={slotForNow()}/></div>;
}
