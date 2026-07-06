/* Display/input unit conversion. Canonical storage is always metric (kg/cm/ml) —
 * this module only converts at the UI edges, per profiles.units. Never store
 * imperial values; convert to metric before any DB write. */

export type UnitsPref = "metric" | "imperial";

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;
const ML_PER_FLOZ = 29.5735295; // US fluid ounce

export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inches: number) => inches * CM_PER_IN;
export const mlToFlOz = (ml: number) => ml / ML_PER_FLOZ;
export const flOzToMl = (flOz: number) => flOz * ML_PER_FLOZ;

/** Splits a height in cm into whole feet + remaining inches (rounded to the nearest inch). */
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = Math.round(cmToIn(cm));
  return { ft: Math.floor(totalIn / 12), inches: totalIn % 12 };
}
export const ftInToCm = (ft: number, inches: number) => inToCm(ft * 12 + inches);

export function formatWeight(kg: number | null | undefined, units: UnitsPref, decimals = 1): string {
  if (kg == null) return "—";
  return units === "imperial" ? `${kgToLb(kg).toFixed(decimals)} lb` : `${kg.toFixed(decimals)} kg`;
}

export function formatHeight(cm: number | null | undefined, units: UnitsPref): string {
  if (cm == null) return "—";
  if (units === "metric") return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}'${inches}"`;
}

/** For body measurements (waist/chest/hips/arms) — inches, not feet+inches. */
export function formatLength(cm: number | null | undefined, units: UnitsPref, decimals = 1): string {
  if (cm == null) return "—";
  return units === "imperial" ? `${cmToIn(cm).toFixed(decimals)} in` : `${cm.toFixed(decimals)} cm`;
}

export function formatWater(ml: number, units: UnitsPref): string {
  return units === "imperial" ? `${mlToFlOz(ml).toFixed(0)} fl oz` : `${(ml / 1000).toFixed(1)} L`;
}

/** Converts a raw user-entered value (already in their preferred unit) back to canonical. */
export const weightToKg = (value: number, units: UnitsPref) => (units === "imperial" ? lbToKg(value) : value);
export const lengthToCm = (value: number, units: UnitsPref) => (units === "imperial" ? inToCm(value) : value);
