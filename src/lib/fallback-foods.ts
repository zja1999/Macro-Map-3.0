/* Bundled seed-food snapshot (docs/08 §1d): if the database is unreachable, food
 * search degrades to this static list instead of a hard error. Macros per 100 g. */

export type FallbackFood = {
  id: string; // stable synthetic id — logged via quick-add snapshot, never FK'd
  name: string;
  servingDesc: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const F = (name: string, calories: number, proteinG: number, carbsG: number, fatG: number): FallbackFood => ({
  id: `fallback:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  servingDesc: "100 g",
  calories,
  proteinG,
  carbsG,
  fatG,
});

export const FALLBACK_FOODS: FallbackFood[] = [
  F("Chicken breast, cooked", 165, 31, 0, 3.6),
  F("Ground beef 90/10, cooked", 217, 26, 0, 12),
  F("Salmon, cooked", 206, 22, 0, 12),
  F("Tuna, canned in water", 116, 26, 0, 0.8),
  F("Egg, whole", 143, 12.6, 0.7, 9.5),
  F("Egg whites", 52, 11, 0.7, 0.2),
  F("Greek yogurt, nonfat", 59, 10, 3.6, 0.4),
  F("Cottage cheese, low-fat", 72, 12, 4.3, 1),
  F("Whey protein powder", 400, 80, 8, 6),
  F("White rice, cooked", 130, 2.7, 28, 0.3),
  F("Brown rice, cooked", 112, 2.6, 24, 0.9),
  F("Oats, dry", 379, 13, 68, 6.5),
  F("Whole wheat bread", 247, 13, 41, 3.4),
  F("Pasta, cooked", 158, 5.8, 31, 0.9),
  F("Sweet potato, baked", 90, 2, 21, 0.2),
  F("Black beans, cooked", 132, 8.9, 24, 0.5),
  F("Broccoli", 34, 2.8, 7, 0.4),
  F("Banana", 89, 1.1, 22.8, 0.3),
  F("Apple", 52, 0.3, 13.8, 0.2),
  F("Avocado", 160, 2, 8.5, 14.7),
  F("Olive oil", 884, 0, 0, 100),
  F("Peanut butter", 588, 25, 20, 50),
  F("Almonds", 579, 21, 22, 50),
];

export function searchFallback(q: string, limit = 25): FallbackFood[] {
  const needle = q.toLowerCase();
  return FALLBACK_FOODS.filter((f) => !needle || f.name.toLowerCase().includes(needle)).slice(0, limit);
}
