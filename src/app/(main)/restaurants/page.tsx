import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRemainingMacros } from "@/lib/queries";
import { geocode, getAroundMe, getSavedRestaurantSubjectIds, type AroundMeFilters } from "@/lib/restaurants";
import { todayStr, slotForNow } from "@/lib/utils";
import { logMenuItem, toggleRestaurantSave } from "@/actions/restaurants";
import { Card, Badge, EmptyState } from "@/components/ui";
import { MacroPills } from "@/components/macros";
import { LocationBar } from "@/components/LocationBar";
import { RestaurantMap } from "@/components/RestaurantMap";
import { MealSlotSelect } from "@/components/MealSlotSelect";

export const metadata = { title: "Restaurants" };

// Demo restaurant locations are seeded around downtown Austin, TX.
const DEFAULT = { lat: 30.2672, lng: -97.7431, label: "Downtown Austin (demo area)" };

type SP = {
  lat?: string;
  lng?: string;
  label?: string;
  r?: string;
  q?: string;
  view?: string;
  sort?: string;
  maxKcal?: string;
  minP?: string;
  buildable?: string;
  chain?: string;
};

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await getCurrentUser();
  const sp = await searchParams;

  // address search → Nominatim → canonical lat/lng URL
  if (sp.q) {
    const hit = await geocode(sp.q.slice(0, 120));
    const rest = sp.r ? `&r=${encodeURIComponent(sp.r)}` : "";
    if (hit) redirect(`/restaurants?lat=${hit.lat.toFixed(5)}&lng=${hit.lng.toFixed(5)}&label=${encodeURIComponent(hit.label)}${rest}`);
    redirect(`/restaurants?geofail=1${rest}`);
  }

  const lat = parseFloat(sp.lat ?? "") || DEFAULT.lat;
  const lng = parseFloat(sp.lng ?? "") || DEFAULT.lng;
  const label = sp.lat && sp.lng ? (sp.label ?? "Pinned location") : DEFAULT.label;
  const radiusKm = [2, 5, 10, 25].includes(Number(sp.r)) ? Number(sp.r) : 5;
  const view = sp.view === "map" ? "map" : "list";
  const sort = (["fit", "protein", "kcal", "near"].includes(sp.sort ?? "") ? sp.sort : "fit") as NonNullable<
    AroundMeFilters["sort"]
  >;

  const filters: AroundMeFilters = {
    sort,
    maxKcal: Number(sp.maxKcal) > 0 ? Number(sp.maxKcal) : undefined,
    minProtein: Number(sp.minP) > 0 ? Number(sp.minP) : undefined,
    buildableOnly: sp.buildable === "1",
    chainId: sp.chain || undefined,
  };

  const remaining = user ? await getRemainingMacros(user.id, user.targets, todayStr()) : null;
  const [{ rows, nearby }, savedIds] = await Promise.all([
    getAroundMe({
      lat,
      lng,
      radiusKm,
      remaining,
      goal: user?.profile.goal ?? null,
      filters,
    }),
    user ? getSavedRestaurantSubjectIds(user.id) : Promise.resolve(new Set<string>()),
  ]);

  const baseParams = new URLSearchParams();
  if (sp.lat && sp.lng) {
    baseParams.set("lat", sp.lat);
    baseParams.set("lng", sp.lng);
    baseParams.set("label", label);
  }
  baseParams.set("r", String(radiusKm));
  const href = (updates: Record<string, string | null>) => {
    const p = new URLSearchParams(baseParams);
    if (view === "map") p.set("view", "map");
    if (sort !== "fit") p.set("sort", sort);
    if (filters.buildableOnly) p.set("buildable", "1");
    if (filters.maxKcal) p.set("maxKcal", String(filters.maxKcal));
    if (filters.minProtein) p.set("minP", String(filters.minProtein));
    if (filters.chainId) p.set("chain", filters.chainId);
    for (const [k, v] of Object.entries(updates)) v === null ? p.delete(k) : p.set(k, v);
    return `/restaurants?${p.toString()}`;
  };

  const date = todayStr();
  const slot = slotForNow();
  const chainList = [...nearby.values()];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold">🍔 Around me</h1>
        <div className="flex gap-1 rounded-lg border border-edge bg-card p-0.5 text-xs">
          <Link href={href({ view: null })} className={`rounded-md px-2.5 py-1 font-medium ${view === "list" ? "bg-accent text-black" : "text-ink-dim"}`}>
            List
          </Link>
          <Link href={href({ view: "map" })} className={`rounded-md px-2.5 py-1 font-medium ${view === "map" ? "bg-accent text-black" : "text-ink-dim"}`}>
            Map
          </Link>
        </div>
      </div>

      <LocationBar label={label} radiusKm={radiusKm} />
      {sp.q === undefined && "geofail" in sp && (
        <p className="text-xs text-carbs">Couldn&apos;t find that address — showing the demo area instead.</p>
      )}

      {remaining?.logged && remaining.calories > 150 ? (
        <Card className="flex items-center justify-between px-3 py-2 text-xs">
          <span className="text-ink-dim">
            Ranked for your remaining{" "}
            <span className="font-semibold text-ink">{Math.round(remaining.calories)} kcal</span> ·{" "}
            <span className="font-semibold text-protein">{Math.max(0, Math.round(remaining.proteinG))}g protein</span>
          </span>
          <Link href="/track" className="text-accent hover:underline">
            diary →
          </Link>
        </Card>
      ) : user ? (
        <p className="text-[11px] text-ink-faint">
          Nothing logged today — ranking by your {user.profile.goal === "muscle_gain" ? "bulking" : "cutting"} goal fit
          instead. Log meals to get remaining-macro recommendations.
        </p>
      ) : (
        <p className="text-[11px] text-ink-faint">
          Browsing as a guest — <Link href="/register" className="text-accent hover:underline">sign up</Link> to rank
          places by your goals and remaining macros, and to log meals.
        </p>
      )}

      {view === "map" && (
        <RestaurantMap
          lat={lat}
          lng={lng}
          radiusKm={radiusKm}
          markers={chainList.map((c) => ({
            lat: c.restaurant.lat,
            lng: c.restaurant.lng,
            label: `${c.chain.name} · ${c.distanceKm.toFixed(1)} km`,
            emoji: c.chain.emoji ?? "🍴",
          }))}
        />
      )}

      {/* filter chips */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {(
          [
            ["fit", "Best fit"],
            ["protein", "Protein/kcal"],
            ["kcal", "Lowest kcal"],
            ["near", "Nearest"],
          ] as const
        ).map(([s, l]) => (
          <Link
            key={s}
            href={href({ sort: s === "fit" ? null : s })}
            className={`rounded-full border px-2.5 py-1 ${sort === s ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim"}`}
          >
            {l}
          </Link>
        ))}
        <span className="mx-1 text-edge">|</span>
        <Link
          href={href({ buildable: filters.buildableOnly ? null : "1" })}
          className={`rounded-full border px-2.5 py-1 ${filters.buildableOnly ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim"}`}
        >
          🥣 Buildable
        </Link>
        <Link
          href={href({ maxKcal: filters.maxKcal ? null : "600" })}
          className={`rounded-full border px-2.5 py-1 ${filters.maxKcal ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim"}`}
        >
          ≤600 kcal
        </Link>
        <Link
          href={href({ minP: filters.minProtein ? null : "30" })}
          className={`rounded-full border px-2.5 py-1 ${filters.minProtein ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim"}`}
        >
          30g+ protein
        </Link>
        {chainList.map(({ chain }) => (
          <Link
            key={chain.id}
            href={href({ chain: filters.chainId === chain.id ? null : chain.id })}
            className={`rounded-full border px-2.5 py-1 ${filters.chainId === chain.id ? "border-accent bg-accent/15 text-accent" : "border-edge bg-card text-ink-dim"}`}
          >
            {chain.emoji} {chain.name}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No chains with nutrition data in this area yet"
          hint="The demo dataset covers downtown Austin — search “Austin, TX” or widen the radius. Chain coverage grows via admin imports."
        />
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 40).map((r) => (
            <Card key={r.key} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {r.kind === "combo" ? (
                      <>
                        {r.item.name} <span className="text-ink-faint">+</span> {r.sideItem!.name}{" "}
                        <Badge>combo</Badge>
                      </>
                    ) : (
                      <>
                        {r.item.name}
                        {r.kind === "buildable" && r.build && (
                          <span className="text-xs text-ink-faint"> · {r.build.label.toLowerCase()}</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-faint">
                    <Link href={`/restaurants/${r.chain.id}?${baseParams.toString()}`} className="hover:text-accent">
                      {r.chain.emoji} {r.chain.name}
                    </Link>{" "}
                    · {r.distanceKm.toFixed(1)} km
                    {(r.sodiumMg ?? 0) > 920 && <span className="ml-1.5 text-carbs">⚠ high sodium</span>}
                  </div>
                  <div className="mt-1.5">
                    <MacroPills calories={r.calories} proteinG={r.proteinG} carbsG={r.carbsG} fatG={r.fatG} />
                  </div>
                  {r.fitLabel && <div className="mt-1 text-[10px] font-medium text-accent">✓ {r.fitLabel}</div>}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <form action={toggleRestaurantSave}>
                    <input type="hidden" name="subjectType" value="menu_item" />
                    <input type="hidden" name="subjectId" value={r.item.id} />
                    <input type="hidden" name="path" value="/restaurants" />
                    <button
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        savedIds.has(`menu_item:${r.item.id}`)
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-edge bg-card text-ink-dim hover:text-ink"
                      }`}
                    >
                      {savedIds.has(`menu_item:${r.item.id}`) ? "Saved" : "Save"}
                    </button>
                  </form>
                  {r.kind === "buildable" ? (
                    <Link
                      href={`/restaurants/build/${r.item.id}`}
                      className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black"
                    >
                      Build →
                    </Link>
                  ) : (
                    <form action={logMenuItem} className="flex flex-col gap-1.5">
                      <input type="hidden" name="menuItemId" value={r.item.id} />
                      {r.sideItem && <input type="hidden" name="sideItemId" value={r.sideItem.id} />}
                      <input type="hidden" name="logDate" value={date} />
                      <MealSlotSelect defaultValue={slot} />
                      <button className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black">Log</button>
                    </form>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-[10px] text-ink-faint">
        Nutrition data is label-imported from chain nutrition pages. Locations are demo-seeded; live POI lookup
        (Overpass) is on the roadmap.
      </p>
    </div>
  );
}
