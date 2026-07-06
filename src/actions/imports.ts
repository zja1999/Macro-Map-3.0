"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db/client";
import { chains, foods, menuItems, nutritionImportBatches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

/* Admin nutrition import (docs/08 §1d): CSV paste → required-field + numeric-sanity
 * checks, duplicate detection against the file AND existing rows, and a changelog
 * batch so a bad import is auditable. */

type RowError = { row: number; message: string };

function parseCsv(text: string): string[][] {
  // minimal CSV: handles quoted fields with commas; no embedded newlines
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cells: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === "," && !inQ) {
          cells.push(cur.trim());
          cur = "";
        } else cur += ch;
      }
      cells.push(cur.trim());
      return cells;
    });
}

const num = (s: string | undefined) => {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

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
  // 4/4/9 sanity: computed kcal should be within 40% of stated (labels round loosely)
  const computed = p * 4 + c * 4 + f * 9;
  if (calories > 50 && computed > 0 && Math.abs(computed - calories) / calories > 0.4) {
    errors.push({ row: rowNum, message: `calories (${calories}) don't match macros (~${Math.round(computed)} kcal)` });
    return false;
  }
  return true;
}

export async function importNutritionCsv(
  _prev: { error?: string; summary?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string; summary?: string }> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) return { error: "Admin only" };

  const target = z.enum(["foods", "menu_items"]).catch("foods").parse(formData.get("target"));
  const filename = String(formData.get("filename") || "pasted.csv").slice(0, 120);
  const csv = String(formData.get("csv") ?? "");
  if (csv.length > 500_000) return { error: "File too large (500KB max)" };

  const table = parseCsv(csv);
  if (table.length < 2) return { error: "Need a header row plus at least one data row" };
  const header = table[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
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
      seen.add(key); // also catches dupes within the file
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
      if (!chainId) return void errors.push({ row: rowNum, message: `unknown chain "${row.chain}" — create it first` });
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
    summary: `${inserted} inserted · ${duplicates} duplicates skipped · ${errors.length} errors${
      errors.length ? ` (first: row ${errors[0].row} — ${errors[0].message})` : ""
    }`,
  };
}
