"use client";

import { useActionState } from "react";
import { importNutritionCsv } from "@/actions/imports";
import { inputCls, btnPrimary } from "./ui";

export function AdminImportForm() {
  const [state, action, pending] = useActionState(importNutritionCsv, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-edge bg-card p-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-ink-dim">
          Target table
          <select name="target" className={inputCls}>
            <option value="foods">foods</option>
            <option value="menu_items">menu_items</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-ink-dim">
          Source label
          <input name="filename" maxLength={120} placeholder="e.g. usda-batch-3.csv" className={inputCls} />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-ink-dim">
        CSV (header row required)
        <textarea
          name="csv"
          required
          rows={8}
          placeholder={
            "foods:      name,calories,protein_g,carbs_g,fat_g[,brand,serving_desc,serving_grams,fiber_g,sodium_mg]\nmenu_items: chain,name,calories,protein_g,carbs_g,fat_g[,category,fiber_g,sodium_mg,combo_group]"
          }
          className={`${inputCls} resize-y font-mono text-xs`}
        />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.summary && <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{state.summary}</p>}
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Validating & importing…" : "Validate + import"}
      </button>
    </form>
  );
}
