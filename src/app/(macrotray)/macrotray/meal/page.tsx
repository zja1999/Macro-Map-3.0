import Link from "next/link";
import { desc, ilike } from "drizzle-orm";
import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { requireMacroTrayUser } from "@/lib/macrotray";
import { getDayLogs, getFrequents, getSavedRecipes } from "@/lib/queries";
import { getMyOrders } from "@/lib/restaurants";
import { MEAL_SLOTS, round1, slotForNow, todayStr } from "@/lib/utils";
import { quickAdd, logRecipe } from "@/actions/logging";
import { logGoToOrder } from "@/actions/restaurants";
import { FoodRow } from "@/components/FoodRow";
import { MacroPills } from "@/components/macros";
import { Card, inputCls, btnPrimary } from "@/components/ui";

type SP = { q?: string; tab?: string; slot?: string };

export default async function MacroTrayMealPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireMacroTrayUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 60);
  const tab = sp.tab === "saved" ? "saved" : sp.tab === "quick" ? "quick" : "search";
  const slot = MEAL_SLOTS.includes(sp.slot as (typeof MEAL_SLOTS)[number]) ? sp.slot! : slotForNow();
  const date = todayStr();
  const [results, frequents, saved, orders, day] = await Promise.all([
    tab === "search" ? db.select().from(foods).where(q ? ilike(foods.name, `%${q}%`) : undefined).orderBy(desc(foods.verified), foods.name).limit(18) : [],
    tab === "search" ? getFrequents(user.id, 6) : [],
    tab === "saved" ? getSavedRecipes(user.id) : [],
    tab === "saved" ? getMyOrders(user.id) : [],
    getDayLogs(user.id, date),
  ]);
  const kcal = Math.round(day.logs.reduce((sum, row) => sum + row.calories, 0));
  const href = (nextTab: string, nextSlot = slot) => `/macrotray/meal?tab=${nextTab}&slot=${nextSlot}`;
  return <div className="space-y-3 pb-8">
    <div className="flex items-end justify-between"><div><h1 className="text-base font-bold">Log a meal</h1><p className="text-[10px] text-ink-faint">{kcal} kcal logged today</p></div><span className="text-xs capitalize text-accent">{slot}</span></div>
    <div className="flex gap-1">{MEAL_SLOTS.map((s) => <Link key={s} href={href(tab, s)} className={`flex-1 rounded-full border px-1 py-1 text-center text-[10px] capitalize ${s === slot ? "border-accent bg-accent/15 text-accent" : "border-edge text-ink-dim"}`}>{s}</Link>)}</div>
    <div className="flex rounded-full border border-edge bg-card p-1">{[["search","Search"],["saved","Saved"],["quick","Quick add"]].map(([key,label]) => <Link key={key} href={href(key)} className={`flex-1 rounded-full px-2 py-1 text-center text-xs font-semibold ${tab === key ? "bg-accent text-black" : "text-ink-dim"}`}>{label}</Link>)}</div>
    {tab === "search" && <>
      <form><input type="hidden" name="tab" value="search"/><input type="hidden" name="slot" value={slot}/><input name="q" type="search" defaultValue={q} placeholder="Search foods…" autoFocus className={inputCls}/></form>
      {!q && frequents.length > 0 && <div className="flex flex-wrap gap-1.5">{frequents.map((f) => <form key={f.name} action={quickAdd}><input type="hidden" name="logDate" value={date}/><input type="hidden" name="mealSlot" value={slot}/><input type="hidden" name="stay" value="1"/><input type="hidden" name="name" value={f.name.slice(0,80)}/><input type="hidden" name="calories" value={round1(Number(f.calories))}/><input type="hidden" name="proteinG" value={round1(Number(f.proteinG))}/><input type="hidden" name="carbsG" value={round1(Number(f.carbsG))}/><input type="hidden" name="fatG" value={round1(Number(f.fatG))}/><button className="rounded-full border border-edge bg-card px-2.5 py-1 text-xs text-ink-dim hover:border-accent">↻ {f.name}</button></form>)}</div>}
      <div className="space-y-2">{results.map((food) => <FoodRow key={food.id} date={date} slot={slot} food={food}/>)}</div>
    </>}
    {tab === "saved" && <div className="space-y-2">
      {orders.map(({ order, chain }) => <Card key={order.id} className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{chain.emoji} {order.name}</div><MacroPills {...order}/></div><form action={logGoToOrder}><input type="hidden" name="orderId" value={order.id}/><input type="hidden" name="logDate" value={date}/><input type="hidden" name="mealSlot" value={slot}/><button className={btnPrimary}>Log</button></form></Card>)}
      {saved.map(({ recipe }) => <Card key={recipe.id} className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{recipe.name}</div><MacroPills {...recipe}/></div><form action={logRecipe}><input type="hidden" name="recipeId" value={recipe.id}/><input type="hidden" name="logDate" value={date}/><input type="hidden" name="mealSlot" value={slot}/><input type="hidden" name="servings" value="1"/><input type="hidden" name="stay" value="1"/><button className={btnPrimary}>Log</button></form></Card>)}
      {!orders.length && !saved.length && <p className="py-8 text-center text-xs text-ink-faint">No saved meals yet.</p>}
    </div>}
    {tab === "quick" && <Card className="p-3"><form action={quickAdd} className="space-y-3"><input type="hidden" name="logDate" value={date}/><input type="hidden" name="mealSlot" value={slot}/><input type="hidden" name="stay" value="1"/><input name="name" required maxLength={80} placeholder="What did you eat?" className={inputCls}/><div className="grid grid-cols-2 gap-2"><input type="number" name="calories" required min={0} step="0.1" placeholder="Calories" className={inputCls}/><input type="number" name="proteinG" min={0} step="0.1" placeholder="Protein g" className={inputCls}/><input type="number" name="carbsG" min={0} step="0.1" placeholder="Carbs g" className={inputCls}/><input type="number" name="fatG" min={0} step="0.1" placeholder="Fat g" className={inputCls}/></div><button className={`${btnPrimary} w-full`}>Log it</button></form></Card>}
  </div>;
}
