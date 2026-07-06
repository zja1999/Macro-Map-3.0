"use client";

import { useActionState } from "react";
import { importNutritionFile } from "@/actions/imports";
import { inputCls, btnPrimary } from "./ui";

export function AdminImportForm() {
  const [state, action, pending] = useActionState(importNutritionFile, undefined);
  return (
    <form action={action} encType="multipart/form-data" className="space-y-3 rounded-xl border border-edge bg-card p-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-ink-dim">
          Target table
          <select name="target" className={inputCls}>
            <option value="foods">foods</option>
            <option value="menu_items">menu_items</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-ink-dim">
          Batch label
          <input name="filename" maxLength={120} placeholder="Defaults to uploaded filename" className={inputCls} />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-ink-dim">
        CSV or Excel file
        <input
          name="file"
          type="file"
          required
          accept=".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className={inputCls}
        />
      </label>
      <p className="text-xs text-ink-faint">
        Header columns can use friendly names like Protein, Carbs, Fat, Sodium, Serving Size, Chain, or Item Name.
        Required for foods: name, calories, protein_g, carbs_g, fat_g. Menu items also require chain.
      </p>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.summary && <p className="rounded-lg bg-accent/10 px-3 py-2 text-xs text-accent">{state.summary}</p>}
      <button disabled={pending} className={btnPrimary}>
        {pending ? "Validating and importing..." : "Validate + import"}
      </button>
    </form>
  );
}
