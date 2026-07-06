/* Restaurant domain logic: nearby chains, the "Around me" cross-chain ranked list
 * (docs/06 §7b), buildable-item build computation (§7a), combo pairing (§7c),
 * and the macro-fit score everything ranks by. Pure functions exported for reuse. */
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  chains,
  restaurants,
  menuItems,
  menuItemOptionGroups,
  menuItemOptions,
  goToOrders,
  profiles,
  saves,
} from "@/db/schema";

export type MenuItem = typeof menuItems.$inferSelect;
export type OptionGroup = typeof menuItemOptionGroups.$inferSelect & {
  options: (typeof menuItemOptions.$inferSelect)[];
};
export type Chain = typeof chains.$inferSelect;

// ─── geo ─────────────────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** Free/keyless Nominatim geocoding (docs/08 §1c). Returns null on miss or network failure. */
export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Macroverse/0.1 (dev)" }, next: { revalidate: 86400 } },
    );
    if (!res.ok) return null;
    const hits: { lat: string; lon: string; display_name: string }[] = await res.json();
    if (!hits[0]) return null;
    return {
      lat: parseFloat(hits[0].lat),
      lng: parseFloat(hits[0].lon),
      label: hits[0].display_name.split(",").slice(0, 2).join(","),
    };
  } catch {
    return null;
  }
}

export type NearbyLocation = {
  restaurant: typeof restaurants.$inferSelect;
  chain: Chain;
  distanceKm: number;
};

/** Locations within radius, nearest first. Bounding-box prefilter in SQL, haversine in TS. */
export async function getNearbyLocations(lat: number, lng: number, radiusKm: number): Promise<NearbyLocation[]> {
  const dLat = radiusKm / 111; // ~1° lat = 111 km
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const rows = await db
    .select({ restaurant: restaurants, chain: chains })
    .from(restaurants)
    .innerJoin(chains, eq(chains.id, restaurants.chainId))
    .where(
      and(
        gte(restaurants.lat, lat - dLat),
        lte(restaurants.lat, lat + dLat),
        gte(restaurants.lng, lng - dLng),
        lte(restaurants.lng, lng + dLng),
      ),
    );
  return rows
    .map((r) => ({ ...r, distanceKm: haversineKm(lat, lng, r.restaurant.lat, r.restaurant.lng) }))
    .filter((r) => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** Distinct chains among nearby locations, keyed by nearest location. */
export function groupByChain(locations: NearbyLocation[]): Map<string, NearbyLocation> {
  const byChain = new Map<string, NearbyLocation>();
  for (const loc of locations) {
    if (!byChain.has(loc.chain.id)) byChain.set(loc.chain.id, loc); // already sorted nearest-first
  }
  return byChain;
}

// ─── macro-fit scoring (docs/06 §7b step 3) ─────────────────────────────────

export type Remaining = { calories: number; proteinG: number; logged: boolean };
type Macros = { calories: number; proteinG: number; sodiumMg?: number | null };

const proteinPer100 = (m: Macros) => (m.proteinG * 100) / Math.max(m.calories, 1);
const SODIUM_WARN_MG = 920; // >40% of 2300mg daily value

/** Higher = better. Tolerance band on remaining calories, protein-need + density bonus,
 *  sodium penalty; falls back to goal-fit when the day is unlogged. 0–100-ish scale. */
export function fitScore(m: Macros, remaining: Remaining | null, goal: string | null): number {
  const density = proteinPer100(m);
  const sodiumPenalty = (m.sodiumMg ?? 0) > SODIUM_WARN_MG ? 10 : 0;

  if (remaining?.logged && remaining.calories > 150) {
    const over = m.calories - remaining.calories;
    const calFit = over <= 0 ? Math.min(1, m.calories / Math.min(remaining.calories, 700)) : Math.max(0, 1 - over / 300);
    const proteinFit =
      remaining.proteinG > 0 ? Math.min(1, m.proteinG / remaining.proteinG) : Math.min(1, density / 12);
    return calFit * 50 + proteinFit * 30 + Math.min(1, density / 15) * 20 - sodiumPenalty;
  }

  // goal-fit fallback: bulking wants protein + calorie sufficiency; cutting wants density under a ceiling
  if (goal === "muscle_gain" || goal === "performance") {
    return Math.min(1, density / 10) * 60 + Math.min(1, m.calories / 800) * 40 - sodiumPenalty;
  }
  return Math.min(1, density / 15) * 70 + Math.max(0, 1 - m.calories / 1400) * 30 - sodiumPenalty;
}

export function fitLabel(m: Macros, remaining: Remaining | null): string | null {
  if (!remaining?.logged || remaining.calories <= 150) return null;
  if (m.calories <= remaining.calories) {
    return `fits your remaining ${Math.round(remaining.calories)} kcal / ${Math.max(0, Math.round(remaining.proteinG))}g protein`;
  }
  const over = Math.round(m.calories - remaining.calories);
  return over <= 250 ? `${over} kcal over your remaining budget` : null;
}

// ─── buildable items: computed builds (docs/06 §7a) ─────────────────────────

export type Build = {
  label: string;
  optionIds: string[];
  optionNames: string[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
};

function sumBuild(label: string, opts: (typeof menuItemOptions.$inferSelect)[]): Build {
  return {
    label,
    optionIds: opts.map((o) => o.id),
    optionNames: opts.map((o) => o.name),
    calories: opts.reduce((a, o) => a + o.calories, 0),
    proteinG: opts.reduce((a, o) => a + o.proteinG, 0),
    carbsG: opts.reduce((a, o) => a + o.carbsG, 0),
    fatG: opts.reduce((a, o) => a + o.fatG, 0),
    sodiumMg: opts.reduce((a, o) => a + (o.sodiumMg ?? 0), 0),
  };
}

/** Three representative builds per buildable item: default, high-protein, light.
 *  The around-me list ranks a buildable by its best-fitting build. */
export function computeBuilds(groups: OptionGroup[]): Build[] {
  const ordered = [...groups].sort((a, b) => a.position - b.position);

  const defaults = ordered.flatMap((g) => g.options.filter((o) => o.isDefault));

  const highProtein = ordered.flatMap((g) => {
    const byProtein = [...g.options].sort((a, b) => b.proteinG - a.proteinG);
    if (g.minChoices >= 1) return byProtein.slice(0, Math.max(1, g.minChoices));
    // optional group: take protein-dense add-ons only
    const cap = g.maxChoices ?? 3;
    return byProtein.filter((o) => proteinPer100(o) >= 10 && o.proteinG >= 2).slice(0, cap);
  });

  const light = ordered.flatMap((g) => {
    if (g.minChoices < 1) return [];
    const byKcal = [...g.options].sort((a, b) => a.calories - b.calories);
    return byKcal.slice(0, Math.max(1, g.minChoices));
  });

  const builds: Build[] = [];
  if (defaults.length) builds.push(sumBuild("Default build", defaults));
  if (highProtein.length) builds.push(sumBuild("High-protein build", highProtein));
  if (light.length) builds.push(sumBuild("Light build", light));
  return builds;
}

export async function getOptionGroups(menuItemId: string): Promise<OptionGroup[]> {
  const groups = await db
    .select()
    .from(menuItemOptionGroups)
    .where(eq(menuItemOptionGroups.menuItemId, menuItemId))
    .orderBy(menuItemOptionGroups.position);
  if (!groups.length) return [];
  const options = await db
    .select()
    .from(menuItemOptions)
    .where(inArray(menuItemOptions.groupId, groups.map((g) => g.id)))
    .orderBy(menuItemOptions.position);
  return groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) }));
}

// ─── the "Around me" concatenated cross-chain list (docs/06 §7b) ─────────────

export type AroundMeRow = {
  key: string;
  kind: "fixed" | "buildable" | "combo";
  item: MenuItem;
  sideItem?: MenuItem; // combo rows log both
  build?: Build; // buildable rows show their best-fit build
  chain: Chain;
  distanceKm: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number | null;
  fit: number;
  fitLabel: string | null;
};

export type AroundMeFilters = {
  maxKcal?: number;
  minProtein?: number;
  buildableOnly?: boolean;
  chainId?: string;
  sort?: "fit" | "protein" | "kcal" | "near";
};

export async function getAroundMe(opts: {
  lat: number;
  lng: number;
  radiusKm: number;
  remaining: Remaining | null;
  goal: string | null;
  filters?: AroundMeFilters;
}): Promise<{ rows: AroundMeRow[]; nearby: Map<string, NearbyLocation> }> {
  const f = opts.filters ?? {};
  const locations = await getNearbyLocations(opts.lat, opts.lng, opts.radiusKm);
  const nearby = groupByChain(locations);
  if (nearby.size === 0) return { rows: [], nearby };

  const chainIds = f.chainId && nearby.has(f.chainId) ? [f.chainId] : [...nearby.keys()];
  const items = await db.select().from(menuItems).where(inArray(menuItems.chainId, chainIds));

  // option groups for all nearby buildables, one query
  const buildableIds = items.filter((i) => i.kind === "buildable").map((i) => i.id);
  const groupRows = buildableIds.length
    ? await db.select().from(menuItemOptionGroups).where(inArray(menuItemOptionGroups.menuItemId, buildableIds))
    : [];
  const optionRows = groupRows.length
    ? await db
        .select()
        .from(menuItemOptions)
        .where(inArray(menuItemOptions.groupId, groupRows.map((g) => g.id)))
        .orderBy(menuItemOptions.position)
    : [];
  const groupsByItem = new Map<string, OptionGroup[]>();
  for (const g of groupRows) {
    const withOpts = { ...g, options: optionRows.filter((o) => o.groupId === g.id) };
    groupsByItem.set(g.menuItemId, [...(groupsByItem.get(g.menuItemId) ?? []), withOpts]);
  }

  const score = (m: Macros) => fitScore(m, opts.remaining, opts.goal);
  const rows: AroundMeRow[] = [];

  for (const item of items) {
    const near = nearby.get(item.chainId)!;
    const base = { chain: near.chain, distanceKm: near.distanceKm };

    if (item.kind === "buildable") {
      const builds = computeBuilds(groupsByItem.get(item.id) ?? []);
      const scored = builds.length
        ? builds.map((b) => ({ build: b, fit: score(b) })).sort((a, b) => b.fit - a.fit)[0]
        : { build: undefined, fit: score(item) };
      const m = scored.build ?? item;
      rows.push({
        key: item.id,
        kind: "buildable",
        item,
        build: scored.build,
        ...base,
        calories: m.calories,
        proteinG: m.proteinG,
        carbsG: m.carbsG,
        fatG: m.fatG,
        sodiumMg: m.sodiumMg ?? null,
        fit: scored.fit,
        fitLabel: fitLabel(m, opts.remaining),
      });
    } else {
      rows.push({
        key: item.id,
        kind: "fixed",
        item,
        ...base,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        sodiumMg: item.sodiumMg,
        fit: score(item),
        fitLabel: fitLabel(item, opts.remaining),
      });
    }
  }

  // combo pairing (docs/06 §7c): entree + best side where the pairing is known.
  // Surfaced only when the pair scores at least as well as the entree alone.
  const entrees = items.filter((i) => i.comboGroup === "entree");
  const sidesByChain = new Map<string, MenuItem[]>();
  for (const s of items.filter((i) => i.comboGroup === "side")) {
    sidesByChain.set(s.chainId, [...(sidesByChain.get(s.chainId) ?? []), s]);
  }
  for (const entree of entrees) {
    const sides = sidesByChain.get(entree.chainId) ?? [];
    if (!sides.length) continue;
    const near = nearby.get(entree.chainId)!;
    let best: { side: MenuItem; fit: number; m: Required<Pick<AroundMeRow, "calories" | "proteinG" | "carbsG" | "fatG">> & { sodiumMg: number | null } } | null = null;
    for (const side of sides) {
      const m = {
        calories: entree.calories + side.calories,
        proteinG: entree.proteinG + side.proteinG,
        carbsG: entree.carbsG + side.carbsG,
        fatG: entree.fatG + side.fatG,
        sodiumMg: (entree.sodiumMg ?? 0) + (side.sodiumMg ?? 0) || null,
      };
      const fit = score(m);
      if (!best || fit > best.fit) best = { side, fit, m };
    }
    const entreeAlone = rows.find((r) => r.key === entree.id);
    if (best && entreeAlone && best.fit >= entreeAlone.fit) {
      rows.push({
        key: `${entree.id}+${best.side.id}`,
        kind: "combo",
        item: entree,
        sideItem: best.side,
        chain: near.chain,
        distanceKm: near.distanceKm,
        ...best.m,
        fit: best.fit,
        fitLabel: fitLabel(best.m, opts.remaining),
      });
    }
  }

  let filtered = rows;
  if (f.maxKcal) filtered = filtered.filter((r) => r.calories <= f.maxKcal!);
  if (f.minProtein) filtered = filtered.filter((r) => r.proteinG >= f.minProtein!);
  if (f.buildableOnly) filtered = filtered.filter((r) => r.kind === "buildable");

  filtered.sort(
    f.sort === "protein"
      ? (a, b) => proteinPer100(b) - proteinPer100(a)
      : f.sort === "kcal"
        ? (a, b) => a.calories - b.calories
        : f.sort === "near"
          ? (a, b) => a.distanceKm - b.distanceKm || b.fit - a.fit
          : (a, b) => b.fit - a.fit,
  );
  return { rows: filtered, nearby };
}

// ─── chain browse + popular builds ───────────────────────────────────────────

export async function getChainWithItems(chainId: string) {
  const [chain] = await db.select().from(chains).where(eq(chains.id, chainId)).limit(1);
  if (!chain) return null;
  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.chainId, chainId))
    .orderBy(desc(menuItems.proteinG));
  return { chain, items };
}

/** Public go-to orders for a chain, most-logged first — "what should I actually get here". */
export async function getPopularOrders(chainId: string, limit = 8) {
  return db
    .select({ order: goToOrders, username: profiles.username, displayName: profiles.displayName })
    .from(goToOrders)
    .innerJoin(profiles, eq(profiles.userId, goToOrders.userId))
    .where(and(eq(goToOrders.chainId, chainId), eq(goToOrders.isPublic, true)))
    .orderBy(desc(goToOrders.logCount), desc(goToOrders.createdAt))
    .limit(limit);
}

export async function getMyOrders(userId: string) {
  return db
    .select({ order: goToOrders, chain: chains })
    .from(goToOrders)
    .innerJoin(chains, eq(chains.id, goToOrders.chainId))
    .where(eq(goToOrders.userId, userId))
    .orderBy(desc(goToOrders.logCount), desc(goToOrders.createdAt));
}

export async function getMyUsuals(userId: string) {
  const saved = await db
    .select()
    .from(saves)
    .where(and(eq(saves.userId, userId), inArray(saves.subjectType, ["menu_item", "go_to_order"])));
  const menuIds = saved.filter((s) => s.subjectType === "menu_item").map((s) => s.subjectId);
  const orderIds = saved.filter((s) => s.subjectType === "go_to_order").map((s) => s.subjectId);

  const [menuRows, orderRows] = await Promise.all([
    menuIds.length
      ? db
          .select({ item: menuItems, chain: chains })
          .from(menuItems)
          .innerJoin(chains, eq(chains.id, menuItems.chainId))
          .where(inArray(menuItems.id, menuIds))
      : [],
    orderIds.length
      ? db
          .select({ order: goToOrders, chain: chains })
          .from(goToOrders)
          .innerJoin(chains, eq(chains.id, goToOrders.chainId))
          .where(inArray(goToOrders.id, orderIds))
      : [],
  ]);

  return { menuItems: menuRows, orders: orderRows };
}

export async function getSavedRestaurantSubjectIds(userId: string) {
  const rows = await db
    .select({ subjectType: saves.subjectType, subjectId: saves.subjectId })
    .from(saves)
    .where(and(eq(saves.userId, userId), inArray(saves.subjectType, ["menu_item", "go_to_order"])));
  return new Set(rows.map((r) => `${r.subjectType}:${r.subjectId}`));
}
