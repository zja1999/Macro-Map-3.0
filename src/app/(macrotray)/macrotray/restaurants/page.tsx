import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMacroTrayUser } from "@/lib/macrotray";
import { getRemainingMacros } from "@/lib/queries";
import { geocode, getAroundMe, type AroundMeFilters } from "@/lib/restaurants";
import { todayStr, slotForNow } from "@/lib/utils";
import { logMenuItem } from "@/actions/restaurants";
import { LocationBar } from "@/components/LocationBar";
import { MacroPills } from "@/components/macros";
import { MealSlotSelect } from "@/components/MealSlotSelect";
import { Card } from "@/components/ui";

const DEFAULT = { lat: 30.2672, lng: -97.7431, label: "Downtown Austin (demo area)" };
type SP = { lat?: string; lng?: string; label?: string; r?: string; q?: string; sort?: string; maxKcal?: string; minP?: string; buildable?: string };

export default async function MacroTrayRestaurantsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireMacroTrayUser();
  const sp = await searchParams;
  if (sp.q) {
    const hit = await geocode(sp.q.slice(0, 120));
    if (hit) redirect(`/macrotray/restaurants?lat=${hit.lat.toFixed(5)}&lng=${hit.lng.toFixed(5)}&label=${encodeURIComponent(hit.label)}&r=${sp.r ?? "5"}`);
    redirect("/macrotray/restaurants?geofail=1");
  }
  const lat = parseFloat(sp.lat ?? "") || DEFAULT.lat;
  const lng = parseFloat(sp.lng ?? "") || DEFAULT.lng;
  const label = sp.lat && sp.lng ? sp.label ?? "Pinned location" : DEFAULT.label;
  const radiusKm = [2,5,10,25].includes(Number(sp.r)) ? Number(sp.r) : 5;
  const sort = (["fit","protein","kcal","near"].includes(sp.sort ?? "") ? sp.sort : "fit") as NonNullable<AroundMeFilters["sort"]>;
  const filters: AroundMeFilters = { sort, maxKcal: Number(sp.maxKcal) || undefined, minProtein: Number(sp.minP) || undefined, buildableOnly: sp.buildable === "1" };
  const remaining = await getRemainingMacros(user.id, user.targets, todayStr());
  const { rows } = await getAroundMe({ lat, lng, radiusKm, remaining, goal: user.profile.goal, filters });
  const base = new URLSearchParams({ r: String(radiusKm) });
  if (sp.lat && sp.lng) { base.set("lat", sp.lat); base.set("lng", sp.lng); base.set("label", label); }
  const href = (key: string, value?: string) => { const p = new URLSearchParams(base); if (value) p.set(key, value); return `/macrotray/restaurants?${p}`; };
  return <div className="space-y-3 pb-8"><div><h1 className="text-base font-bold">Find a restaurant meal</h1><p className="text-xs text-ink-faint">Ranked against today’s remaining macros.</p></div><LocationBar label={label} radiusKm={radiusKm} basePath="/macrotray/restaurants"/><div className="flex flex-wrap gap-1.5 text-[10px]">{[["fit","Best fit"],["protein","Protein"],["kcal","Lowest kcal"],["near","Nearest"]].map(([key,text]) => <Link key={key} href={href("sort", key)} className={`rounded-full border px-2 py-1 ${sort === key ? "border-accent bg-accent/15 text-accent" : "border-edge text-ink-dim"}`}>{text}</Link>)}<Link href={href("maxKcal","600")} className="rounded-full border border-edge px-2 py-1 text-ink-dim">≤600 kcal</Link><Link href={href("minP","30")} className="rounded-full border border-edge px-2 py-1 text-ink-dim">30g+ protein</Link></div><div className="space-y-2">{rows.slice(0,25).map((row) => <Card key={row.key} className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-medium">{row.item.name}{row.sideItem ? ` + ${row.sideItem.name}` : ""}</div><div className="text-[10px] text-ink-faint">{row.chain.emoji} {row.chain.name} · {row.distanceKm.toFixed(1)} km</div><div className="mt-1"><MacroPills calories={row.calories} proteinG={row.proteinG} carbsG={row.carbsG} fatG={row.fatG}/></div>{row.fitLabel && <div className="mt-1 text-[10px] text-accent">✓ {row.fitLabel}</div>}</div>{row.kind === "buildable" ? <Link href={`/macrotray/restaurants/build/${row.item.id}`} className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Build</Link> : <form action={logMenuItem} className="shrink-0 space-y-1"><input type="hidden" name="menuItemId" value={row.item.id}/>{row.sideItem && <input type="hidden" name="sideItemId" value={row.sideItem.id}/>}<input type="hidden" name="logDate" value={todayStr()}/><MealSlotSelect defaultValue={slotForNow()}/><button className="w-full rounded-lg bg-accent px-2 py-1 text-xs font-bold text-black">Log</button></form>}</div></Card>)}{!rows.length && <p className="py-8 text-center text-xs text-ink-faint">No nutrition-backed restaurants found here. Try Austin, TX or a wider radius.</p>}</div></div>;
}
