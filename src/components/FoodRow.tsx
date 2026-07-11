"use client";

import { useState } from "react";
import { BadgeCheck, Minus, Plus } from "lucide-react";
import { logFood } from "@/actions/logging";
import { Sheet } from "@/components/overlays";
import { MacroPills } from "@/components/macros";
import { toast } from "@/components/toast";
import { MEAL_SLOTS, round1 } from "@/lib/utils";

export type FoodRowData = {
  id: string;
  name: string;
  brand: string | null;
  verified: boolean;
  servingDesc: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Search-result row (plan §4.1): tapping the row opens a detail sheet with a
 * serving stepper + slot chips; the trailing + is the one-tap quick add at
 * one serving to the current slot. Both stay in the multi-add flow (stay=1).
 */
export function FoodRow({ food, date, slot }: { food: FoodRowData; date: string; slot: string }) {
  const [open, setOpen] = useState(false);
  const [servings, setServings] = useState(1);
  const [sheetSlot, setSheetSlot] = useState(slot);

  const logged = (n: number) =>
    toast(`Added ${food.name.length > 26 ? `${food.name.slice(0, 26)}…` : food.name}${n !== 1 ? ` ×${n}` : ""}`);

  const submit = async (formData: FormData) => {
    try {
      await logFood(formData);
      setOpen(false);
      logged(Number(formData.get("servings")));
    } catch {
      toast("Couldn't add that — try again", { tone: "error" });
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-3">
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={food.name}
        trigger={
          <button type="button" className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium">
              {food.name}
              {food.brand && <span className="text-text-tertiary"> · {food.brand}</span>}
              {food.verified && (
                <BadgeCheck size={13} className="ml-1 inline-block align-[-2px] text-accent" aria-label="Verified" />
              )}
            </div>
            <div className="mt-1">
              <MacroPills calories={food.calories} proteinG={food.proteinG} carbsG={food.carbsG} fatG={food.fatG} />
            </div>
            <div className="mt-0.5 text-[10px] text-text-tertiary">per {food.servingDesc}</div>
          </button>
        }
      >
        <form action={submit} className="space-y-4 pb-2">
          <input type="hidden" name="foodId" value={food.id} />
          <input type="hidden" name="logDate" value={date} />
          <input type="hidden" name="mealSlot" value={sheetSlot} />
          <input type="hidden" name="servings" value={servings} />
          <input type="hidden" name="stay" value="1" />

          <MacroPills
            calories={food.calories * servings}
            proteinG={food.proteinG * servings}
            carbsG={food.carbsG * servings}
            fatG={food.fatG * servings}
          />

          {/* serving stepper */}
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setServings((s) => Math.max(0.5, round1(s - 0.5)))}
              aria-label="Fewer servings"
              className="rounded-full border border-border bg-surface-2 p-2.5 text-text-secondary transition hover:text-text active:scale-95"
            >
              <Minus size={18} />
            </button>
            <div className="w-20 text-center">
              <div className="text-stat">{servings}</div>
              <div className="text-micro text-text-tertiary">serving{servings !== 1 ? "s" : ""}</div>
            </div>
            <button
              type="button"
              onClick={() => setServings((s) => Math.min(50, round1(s + 0.5)))}
              aria-label="More servings"
              className="rounded-full border border-border bg-surface-2 p-2.5 text-text-secondary transition hover:text-text active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* slot chips */}
          <div className="flex gap-1.5">
            {MEAL_SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSheetSlot(s)}
                className={`flex-1 rounded-full border px-2 py-1.5 text-xs font-semibold capitalize transition ${
                  s === sheetSlot
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-border bg-surface-2 text-text-secondary"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <button className="w-full rounded-lg bg-accent px-4 py-3 text-base font-semibold text-black transition hover:brightness-110 active:scale-[0.99]">
            Add to {sheetSlot}
          </button>
        </form>
      </Sheet>

      {/* one-tap quick add: 1 serving to the current slot */}
      <form
        action={async (fd) => {
          try {
            await logFood(fd);
            logged(1);
          } catch {
            toast("Couldn't add that — try again", { tone: "error" });
          }
        }}
        className="shrink-0"
      >
        <input type="hidden" name="foodId" value={food.id} />
        <input type="hidden" name="logDate" value={date} />
        <input type="hidden" name="mealSlot" value={slot} />
        <input type="hidden" name="servings" value={1} />
        <input type="hidden" name="stay" value="1" />
        <button
          aria-label="Log"
          className="rounded-full bg-accent p-2 text-black shadow-sm shadow-accent/30 transition hover:brightness-110 active:scale-90"
        >
          <Plus size={16} strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
