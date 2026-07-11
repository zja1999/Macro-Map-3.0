import { round1 } from "./utils";

/* Extended-nutrition label set. Null everywhere means "no data" —
 * never zero-filled, so day totals can say how many items lacked data. */

export const NUTRIENT_DEFS = [
  // dv = FDA adult Daily Value used for the %DV readout; null = no official DV
  { key: "fiberG", label: "Fiber", unit: "g", dv: 28 },
  { key: "sugarG", label: "Sugar", unit: "g", dv: null },
  { key: "addedSugarG", label: "Added sugar", unit: "g", dv: 50 },
  { key: "saturatedFatG", label: "Saturated fat", unit: "g", dv: 20 },
  { key: "sodiumMg", label: "Sodium", unit: "mg", dv: 2300 },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg", dv: 300 },
  { key: "potassiumMg", label: "Potassium", unit: "mg", dv: 4700 },
  { key: "calciumMg", label: "Calcium", unit: "mg", dv: 1300 },
  { key: "ironMg", label: "Iron", unit: "mg", dv: 18 },
  { key: "vitaminAMcg", label: "Vitamin A", unit: "mcg", dv: 900 },
  { key: "vitaminCMg", label: "Vitamin C", unit: "mg", dv: 90 },
  { key: "vitaminDMcg", label: "Vitamin D", unit: "mcg", dv: 20 },
] as const;

export type NutrientKey = (typeof NUTRIENT_DEFS)[number]["key"];
export type NutrientValues = Partial<Record<NutrientKey, number | null>>;

/** Scales a source row's nutrient fields by servings for the food_logs snapshot. */
export function nutrientSnapshot(src: NutrientValues, servings: number): Record<NutrientKey, number | null> {
  const out = {} as Record<NutrientKey, number | null>;
  for (const { key } of NUTRIENT_DEFS) {
    const v = src[key];
    out[key] = v == null ? null : round1(v * servings);
  }
  return out;
}

/** Sums nutrient fields across logs. `covered[key]` false means NO log carried that
 * nutrient (render "—", not 0); `missing` counts logs with no data at all. */
export function nutrientTotals(logs: NutrientValues[]) {
  const totals = Object.fromEntries(NUTRIENT_DEFS.map((d) => [d.key, 0])) as Record<NutrientKey, number>;
  const covered = Object.fromEntries(NUTRIENT_DEFS.map((d) => [d.key, false])) as Record<NutrientKey, boolean>;
  let missing = 0;
  for (const log of logs) {
    let hasAny = false;
    for (const { key } of NUTRIENT_DEFS) {
      const v = log[key];
      if (v != null) {
        totals[key] += v;
        covered[key] = true;
        hasAny = true;
      }
    }
    if (!hasAny) missing++;
  }
  return { totals, covered, missing };
}
