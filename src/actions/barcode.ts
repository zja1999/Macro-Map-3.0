"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { foods } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { round1 } from "@/lib/utils";

/* Barcode → food via Open Food Facts (docs/10 §2). Free + keyless; an imported
 * food is a normal unverified `foods` row (source='off_import') that the
 * community can correct like any user submission. */

const lookupSchema = z.object({
  barcode: z.string().regex(/^\d{8,14}$/, "Barcodes are 8–14 digits"),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
});

type Nutriments = Record<string, number | undefined>;

// OFF stores minerals/vitamins per 100 g in grams — convert to label units
const mg = (v: number | undefined) => (v == null ? null : round1(v * 1000));
const mcg = (v: number | undefined) => (v == null ? null : round1(v * 1_000_000));
const g = (v: number | undefined) => (v == null ? null : round1(v));

export async function lookupBarcode(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parsed = lookupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const toAdd = (name: string) =>
    `/track/add?date=${d.logDate}&slot=${d.mealSlot}&q=${encodeURIComponent(name.slice(0, 60))}`;

  // already imported once → straight to the log flow
  const [existing] = await db.select().from(foods).where(eq(foods.barcode, d.barcode)).limit(1);
  if (existing) redirect(toAdd(existing.name));

  let product: { product_name?: string; brands?: string; nutriments?: Nutriments } | undefined;
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${d.barcode}.json?fields=product_name,brands,nutriments`,
      { headers: { "User-Agent": "MacroVerse/1.0 (macro tracking app)" }, signal: AbortSignal.timeout(8000) },
    );
    if (res.status === 404) return { error: "Not in Open Food Facts — use Quick add or create the food manually." };
    if (!res.ok) return { error: "Open Food Facts is unreachable right now — try again in a minute." };
    product = (await res.json()).product;
  } catch {
    return { error: "Open Food Facts is unreachable right now — try again in a minute." };
  }

  const n = product?.nutriments ?? {};
  const calories = n["energy-kcal_100g"] ?? (n["energy_100g"] != null ? n["energy_100g"] / 4.184 : undefined);
  if (!product?.product_name || calories == null) {
    return { error: "Product found but it has no usable nutrition data — use Quick add instead." };
  }

  const name = product.product_name.slice(0, 120);
  const brand = product.brands?.split(",")[0]?.trim().slice(0, 60) || null;
  const [food] = await db
    .insert(foods)
    .values({
      name,
      brand: brand?.toLowerCase() === name.toLowerCase() ? null : brand,
      servingDesc: "100 g",
      servingGrams: 100,
      calories: round1(calories),
      proteinG: g(n["proteins_100g"]) ?? 0,
      carbsG: g(n["carbohydrates_100g"]) ?? 0,
      fatG: g(n["fat_100g"]) ?? 0,
      fiberG: g(n["fiber_100g"]),
      sugarG: g(n["sugars_100g"]),
      saturatedFatG: g(n["saturated-fat_100g"]),
      sodiumMg: mg(n["sodium_100g"]),
      cholesterolMg: mg(n["cholesterol_100g"]),
      potassiumMg: mg(n["potassium_100g"]),
      calciumMg: mg(n["calcium_100g"]),
      ironMg: mg(n["iron_100g"]),
      vitaminAMcg: mcg(n["vitamin-a_100g"]),
      vitaminCMg: mg(n["vitamin-c_100g"]),
      vitaminDMcg: mcg(n["vitamin-d_100g"]),
      barcode: d.barcode,
      source: "off_import",
      verified: false,
    })
    .returning({ name: foods.name });

  redirect(toAdd(food.name));
}
