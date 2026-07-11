"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { chains, foods, menuItems, nutritionImportBatches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { parseTabularFile } from "@/lib/tabularFiles";

/* Admin nutrition import: CSV/Excel upload -> required-field +
 * numeric-sanity checks, duplicate detection against the file AND existing rows,
 * and a changelog batch so a bad import is auditable. */

type RowError = { row: number; message: string };

const columnAliases: Record<string, string> = {
  calories: "calories",
  calorie: "calories",
  cals: "calories",
  kcal: "calories",
  protein: "protein_g",
  protein_g: "protein_g",
  protein_grams: "protein_g",
  carbs: "carbs_g",
  carb: "carbs_g",
  carbohydrates: "carbs_g",
  carbohydrate: "carbs_g",
  carbs_g: "carbs_g",
  carbohydrate_g: "carbs_g",
  carbohydrate_grams: "carbs_g",
  fat: "fat_g",
  fats: "fat_g",
  fat_g: "fat_g",
  fat_grams: "fat_g",
  fiber: "fiber_g",
  fibre: "fiber_g",
  fiber_g: "fiber_g",
  fibre_g: "fiber_g",
  sodium: "sodium_mg",
  sodium_mg: "sodium_mg",
  serving: "serving_desc",
  serving_size: "serving_desc",
  serving_desc: "serving_desc",
  serving_g: "serving_grams",
  serving_grams: "serving_grams",
  brand_name: "brand",
  restaurant: "chain",
  chain_name: "chain",
  item: "name",
  item_name: "name",
};

const num = (s: string | undefined) => {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

function normalizeHeaderCell(value: string) {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return columnAliases[normalized] ?? normalized;
}

function duplicateColumns(header: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  header.forEach((column) => {
    if (seen.has(column)) duplicates.add(column);
    seen.add(column);
  });
  return [...duplicates];
}

function checkMacros(row: Record<string, string>, rowNum: number, errors: RowError[]): boolean {
  const calories = num(row.calories);
  const p = num(row.protein_g);
  const c = num(row.carbs_g);
  const f = num(row.fat_g);
  if (calories == null || p == null || c == null || f == null || [calories, p, c, f].some(Number.isNaN)) {
    errors.push({ row: rowNum, message: "calories/protein_g/carbs_g/fat_g must all be numeric" });
    return false;
  }
  if (calories < 0 || calories > 3000 || p < 0 || p > 500 || c < 0 || c > 1000 || f < 0 || f > 500) {
    errors.push({ row: rowNum, message: "macro values out of sane range" });
    return false;
  }
  // 4/4/9 sanity: computed kcal should be within 40% of stated (labels round loosely).
  const computed = p * 4 + c * 4 + f * 9;
  if (calories > 50 && computed > 0 && Math.abs(computed - calories) / calories > 0.4) {
    errors.push({ row: rowNum, message: `calories (${calories}) don't match macros (~${Math.round(computed)} kcal)` });
    return false;
  }
  return true;
}

export async function importNutritionFile(
  _prev: { error?: string; summary?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; summary?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) return { error: "Admin only" };

  const target = z.enum(["foods", "menu_items"]).catch("foods").parse(formData.get("target"));
  const upload = formData.get("file");
  if (!(upload instanceof File)) return { error: "Choose a CSV or Excel file to import" };

  let parsed;
  try {
    parsed = await parseTabularFile(upload);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read uploaded file" };
  }

  const filename = String(formData.get("filename") || parsed.filename).slice(0, 120);
  const table = parsed.rows;
  if (table.length < 2) return { error: "Need a header row plus at least one data row" };

  const header = table[0].map(normalizeHeaderCell);
  const duplicateHeaderNames = duplicateColumns(header);
  if (duplicateHeaderNames.length) return { error: `Duplicate columns after normalization: ${duplicateHeaderNames.join(", ")}` };

  const required =
    target === "foods" ? ["name", "calories", "protein_g", "carbs_g", "fat_g"] : ["chain", "name", "calories", "protein_g", "carbs_g", "fat_g"];
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) return { error: `Missing required columns: ${missing.join(", ")}` };

  const rows = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  if (rows.length > 2000) return { error: "2000 rows max per batch" };

  const errors: RowError[] = [];
  let inserted = 0;
  let duplicates = 0;

  if (target === "foods") {
    const existing = await db.select({ name: foods.name, brand: foods.brand }).from(foods);
    const seen = new Set(existing.map((f) => `${f.name.toLowerCase()}|${(f.brand ?? "").toLowerCase()}`));
    const toInsert: (typeof foods.$inferInsert)[] = [];
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      if (!row.name) return void errors.push({ row: rowNum, message: "name is required" });
      if (!checkMacros(row, rowNum, errors)) return;
      const key = `${row.name.toLowerCase()}|${(row.brand ?? "").toLowerCase()}`;
      if (seen.has(key)) return void duplicates++;
      seen.add(key);
      toInsert.push({
        name: row.name,
        brand: row.brand || null,
        servingDesc: row.serving_desc || "100 g",
        servingGrams: num(row.serving_grams) ?? 100,
        calories: num(row.calories)!,
        proteinG: num(row.protein_g)!,
        carbsG: num(row.carbs_g)!,
        fatG: num(row.fat_g)!,
        fiberG: num(row.fiber_g),
        sodiumMg: num(row.sodium_mg),
        source: "admin",
        verified: true,
      });
    });
    if (toInsert.length) await db.insert(foods).values(toInsert);
    inserted = toInsert.length;
  } else {
    const chainRows = await db.select().from(chains);
    const chainByName = new Map(chainRows.map((c) => [c.name.toLowerCase(), c.id]));
    const existing = await db.select({ chainId: menuItems.chainId, name: menuItems.name }).from(menuItems);
    const seen = new Set(existing.map((m) => `${m.chainId}|${m.name.toLowerCase()}`));
    const toInsert: (typeof menuItems.$inferInsert)[] = [];
    rows.forEach((row, i) => {
      const rowNum = i + 2;
      if (!row.name) return void errors.push({ row: rowNum, message: "name is required" });
      const chainId = chainByName.get((row.chain ?? "").toLowerCase());
      if (!chainId) return void errors.push({ row: rowNum, message: `unknown chain "${row.chain}" - create it first` });
      if (!checkMacros(row, rowNum, errors)) return;
      const key = `${chainId}|${row.name.toLowerCase()}`;
      if (seen.has(key)) return void duplicates++;
      seen.add(key);
      toInsert.push({
        chainId,
        name: row.name,
        category: row.category || null,
        comboGroup: row.combo_group === "entree" || row.combo_group === "side" ? row.combo_group : null,
        calories: num(row.calories)!,
        proteinG: num(row.protein_g)!,
        carbsG: num(row.carbs_g)!,
        fatG: num(row.fat_g)!,
        fiberG: num(row.fiber_g),
        sodiumMg: num(row.sodium_mg),
        macroSource: "label_imported",
      });
    });
    if (toInsert.length) await db.insert(menuItems).values(toInsert);
    inserted = toInsert.length;
  }

  await db.insert(nutritionImportBatches).values({
    uploadedBy: user.id,
    target,
    filename,
    rowCount: rows.length,
    insertedCount: inserted,
    duplicateCount: duplicates,
    errorCount: errors.length,
    errors: errors.length ? errors.slice(0, 100) : null,
  });

  revalidatePath("/admin/imports");
  return {
    summary: `${inserted} inserted - ${duplicates} duplicates skipped - ${errors.length} errors${
      errors.length ? ` (first: row ${errors[0].row} - ${errors[0].message})` : ""
    }`,
  };
}

export const importNutritionCsv = importNutritionFile;
