export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateLabel(dateStr: string): string {
  if (dateStr === todayStr()) return "Today";
  if (dateStr === shiftDate(todayStr(), -1)) return "Yesterday";
  return new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;

/** Sensible default meal slot for "log it now" flows. */
export function slotForNow(): (typeof MEAL_SLOTS)[number] {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

export const REACTION_KINDS = [
  { kind: "like", emoji: "❤️", label: "Like" },
  { kind: "strong", emoji: "💪", label: "Strong" },
  { kind: "high_protein", emoji: "🍗", label: "High protein" },
  { kind: "macro_win", emoji: "🎯", label: "Macro win" },
  { kind: "pr", emoji: "🏆", label: "PR" },
  { kind: "meal_prep_win", emoji: "🥡", label: "Meal prep win" },
] as const;

export const RECIPE_TAGS = [
  "high-protein",
  "low-calorie",
  "low-carb",
  "cutting",
  "bulking",
  "meal-prep",
  "budget",
  "quick",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "vegetarian",
  "air-fryer",
  "no-cook",
] as const;

export function macroSourceLabel(source: string): { label: string; tone: "good" | "warn" } {
  switch (source) {
    case "verified":
      return { label: "Verified", tone: "good" };
    case "ingredient_calculated":
      return { label: "Calculated from ingredients", tone: "good" };
    default:
      return { label: "Creator-entered", tone: "warn" };
  }
}
