import { MEAL_SLOTS } from "@/lib/utils";

export function MealSlotSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select
      name="mealSlot"
      defaultValue={defaultValue}
      className="rounded-lg border border-edge bg-surface px-2 py-1.5 text-xs capitalize text-ink"
      aria-label="Meal"
    >
      {MEAL_SLOTS.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  );
}
