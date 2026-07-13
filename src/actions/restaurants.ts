"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { chains, foodLogs, goToOrders, menuItems, saves } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { nutrientSnapshot } from "@/lib/nutrients";
import { getOptionGroups } from "@/lib/restaurants";
import { round1 } from "@/lib/utils";
import { isMacroTrayRequest } from "@/lib/macrotray";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const slotEnum = z.enum(["breakfast", "lunch", "dinner", "snack"]);

// ─── fixed items (and combo pairs: two logs in one action) ───────────────────

const logItemSchema = z.object({
  menuItemId: z.string().uuid(),
  sideItemId: z.string().uuid().optional(), // combo recommendation logs both
  logDate: z.string().regex(dateRe),
  mealSlot: slotEnum,
});

export async function logMenuItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = logItemSchema.parse({
    menuItemId: formData.get("menuItemId"),
    sideItemId: formData.get("sideItemId") || undefined,
    logDate: formData.get("logDate"),
    mealSlot: formData.get("mealSlot"),
  });

  const ids = [d.menuItemId, ...(d.sideItemId ? [d.sideItemId] : [])];
  const items = await db.select().from(menuItems).where(inArray(menuItems.id, ids));
  if (items.length !== ids.length) throw new Error("Menu item not found");
  const byId = new Map(items.map((i) => [i.id, i]));
  const [chain] = await db.select().from(chains).where(eq(chains.id, byId.get(d.menuItemId)!.chainId)).limit(1);

  await db.insert(foodLogs).values(
    ids.map((id) => {
      const item = byId.get(id)!;
      return {
        userId: user.id,
        logDate: d.logDate,
        mealSlot: d.mealSlot,
        menuItemId: item.id,
        name: `${chain?.name ?? "Restaurant"} — ${item.name}`,
        servings: 1,
        calories: item.calories,
        proteinG: item.proteinG,
        carbsG: item.carbsG,
        fatG: item.fatG,
        ...nutrientSnapshot(item, 1),
      };
    }),
  );
  revalidatePath("/track");
  if (await isMacroTrayRequest()) {
    revalidatePath("/macrotray");
    revalidatePath("/macrotray/restaurants");
    return;
  }
  redirect(`/track?date=${d.logDate}`);
}

// ─── buildable items: log a build, optionally save it as a go-to order ──────

const logBuildSchema = z.object({
  menuItemId: z.string().uuid(),
  logDate: z.string().regex(dateRe),
  mealSlot: slotEnum,
  optionIds: z.array(z.string().uuid()).min(1).max(40), // repeats allowed = double portion
  orderName: z.string().max(60).optional(),
  intent: z.enum(["log", "save", "log_save"]),
});

export async function logBuild(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = logBuildSchema.safeParse({
    menuItemId: formData.get("menuItemId"),
    logDate: formData.get("logDate"),
    mealSlot: formData.get("mealSlot"),
    optionIds: JSON.parse(String(formData.get("optionIds") ?? "[]")),
    orderName: formData.get("orderName") || undefined,
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { error: "Pick at least one option" };
  const d = parsed.data;

  const [item] = await db.select().from(menuItems).where(eq(menuItems.id, d.menuItemId)).limit(1);
  if (!item || item.kind !== "buildable") return { error: "Item not found" };
  const [chain] = await db.select().from(chains).where(eq(chains.id, item.chainId)).limit(1);

  // validate selections against this item's option groups (min/max per group)
  const groups = await getOptionGroups(item.id);
  const optionById = new Map(groups.flatMap((g) => g.options).map((o) => [o.id, o]));
  const counts = new Map<string, number>();
  for (const id of d.optionIds) {
    if (!optionById.has(id)) return { error: "Invalid option selected" };
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const g of groups) {
    const n = g.options.reduce((a, o) => a + (counts.get(o.id) ?? 0), 0);
    if (n < g.minChoices) return { error: `Pick at least ${g.minChoices} from ${g.name}` };
    if (g.maxChoices != null && n > g.maxChoices) return { error: `At most ${g.maxChoices} from ${g.name}` };
  }

  const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const names: string[] = [];
  for (const [id, n] of counts) {
    const o = optionById.get(id)!;
    totals.calories += o.calories * n;
    totals.proteinG += o.proteinG * n;
    totals.carbsG += o.carbsG * n;
    totals.fatG += o.fatG * n;
    names.push(n > 1 ? `${o.name.toLowerCase()} ×${n}` : o.name.toLowerCase());
  }
  const displayName = `${chain?.name ?? ""} ${item.name} — ${names.join(", ")}`.trim();

  if (d.intent !== "log" ) {
    if (!d.orderName?.trim()) return { error: "Name your go-to order" };
    await db.insert(goToOrders).values({
      userId: user.id,
      chainId: item.chainId,
      name: d.orderName.trim(),
      items: [{ menuItemId: item.id, optionIds: d.optionIds }],
      calories: round1(totals.calories),
      proteinG: round1(totals.proteinG),
      carbsG: round1(totals.carbsG),
      fatG: round1(totals.fatG),
    });
  }
  if (d.intent !== "save") {
    await db.insert(foodLogs).values({
      userId: user.id,
      logDate: d.logDate,
      mealSlot: d.mealSlot,
      menuItemId: item.id,
      name: displayName.slice(0, 160),
      servings: 1,
      calories: round1(totals.calories),
      proteinG: round1(totals.proteinG),
      carbsG: round1(totals.carbsG),
      fatG: round1(totals.fatG),
    });
    revalidatePath("/track");
    if (await isMacroTrayRequest()) {
      revalidatePath("/macrotray");
      revalidatePath("/macrotray/restaurants");
      return {};
    }
    redirect(`/track?date=${d.logDate}`);
  }
  revalidatePath("/restaurants");
  if (await isMacroTrayRequest()) {
    revalidatePath("/macrotray/restaurants");
    return {};
  }
  redirect(`/restaurants/${item.chainId}`);
}

// ─── go-to orders: one-tap re-log ────────────────────────────────────────────

const logOrderSchema = z.object({
  orderId: z.string().uuid(),
  logDate: z.string().regex(dateRe),
  mealSlot: slotEnum,
});

export async function logGoToOrder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = logOrderSchema.parse(Object.fromEntries(formData));

  const [order] = await db.select().from(goToOrders).where(eq(goToOrders.id, d.orderId)).limit(1);
  if (!order || (!order.isPublic && order.userId !== user.id)) throw new Error("Order not found");
  const [chain] = await db.select().from(chains).where(eq(chains.id, order.chainId)).limit(1);
  const firstItem = (order.items as { menuItemId?: string }[])[0];

  await db.transaction(async (tx) => {
    await tx.insert(foodLogs).values({
      userId: user.id,
      logDate: d.logDate,
      mealSlot: d.mealSlot,
      menuItemId: firstItem?.menuItemId ?? null,
      name: `${chain?.name ?? "Restaurant"} — ${order.name}`,
      servings: 1,
      calories: order.calories,
      proteinG: order.proteinG,
      carbsG: order.carbsG,
      fatG: order.fatG,
    });
    // logged go-to orders drive the "popular builds" ranking
    await tx
      .update(goToOrders)
      .set({ logCount: sql`${goToOrders.logCount} + 1` })
      .where(eq(goToOrders.id, d.orderId));
  });
  revalidatePath("/track");
  if (await isMacroTrayRequest()) {
    revalidatePath("/macrotray");
    revalidatePath("/macrotray/meal");
    revalidatePath("/macrotray/restaurants");
    return;
  }
  redirect(`/track?date=${d.logDate}`);
}

export async function deleteGoToOrder(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const id = z.string().uuid().parse(formData.get("orderId"));
  await db.delete(goToOrders).where(and(eq(goToOrders.id, id), eq(goToOrders.userId, user.id)));
  revalidatePath("/restaurants");
}

const saveRestaurantSchema = z.object({
  subjectType: z.enum(["menu_item", "go_to_order"]),
  subjectId: z.string().uuid(),
  path: z.string().max(120).optional(),
});

export async function toggleRestaurantSave(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const d = saveRestaurantSchema.parse({
    subjectType: formData.get("subjectType"),
    subjectId: formData.get("subjectId"),
    path: formData.get("path") || undefined,
  });

  if (d.subjectType === "menu_item") {
    const [item] = await db.select({ id: menuItems.id }).from(menuItems).where(eq(menuItems.id, d.subjectId)).limit(1);
    if (!item) throw new Error("Menu item not found");
  } else {
    const [order] = await db.select().from(goToOrders).where(eq(goToOrders.id, d.subjectId)).limit(1);
    if (!order || (!order.isPublic && order.userId !== user.id)) throw new Error("Order not found");
  }

  const where = and(eq(saves.userId, user.id), eq(saves.subjectType, d.subjectType), eq(saves.subjectId, d.subjectId));
  const [existing] = await db.select().from(saves).where(where).limit(1);
  if (existing) await db.delete(saves).where(where);
  else await db.insert(saves).values({ userId: user.id, subjectType: d.subjectType, subjectId: d.subjectId });

  revalidatePath("/restaurants");
  revalidatePath("/track/add");
  if (d.path?.startsWith("/")) revalidatePath(d.path);
}
