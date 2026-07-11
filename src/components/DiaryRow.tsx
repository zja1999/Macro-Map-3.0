"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useAnimate } from "motion/react";
import { Trash2, X } from "lucide-react";
import { deleteLogQuiet, restoreLog } from "@/actions/logging";
import { toast } from "@/components/toast";

export type DiaryLog = {
  id: string;
  name: string;
  recipeId: string | null;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/**
 * Swipe-left-to-delete diary row with undo toast (plan §2.4/§3.6). The row
 * hides optimistically; the server revalidation removes it for real. Undo
 * restores the full snapshot (including nutrient columns) server-side.
 * The X button is the desktop/e2e path to the same delete.
 */
export function DiaryRow({ log }: { log: DiaryLog }) {
  const [hidden, setHidden] = useState(false);
  const [scope, animate] = useAnimate();

  const doDelete = async () => {
    setHidden(true);
    try {
      const snapshot = await deleteLogQuiet(log.id);
      if (!snapshot) {
        setHidden(false);
        toast("Couldn't remove that entry — try again", { tone: "error" });
        return;
      }
      toast(`Removed ${log.name.length > 28 ? `${log.name.slice(0, 28)}…` : log.name}`, {
        action: { label: "Undo", onClick: () => void restoreLog(snapshot) },
      });
    } catch {
      setHidden(false);
      toast("Couldn't remove that entry — try again", { tone: "error" });
    }
  };

  if (hidden) return null;

  return (
    <li className="relative overflow-hidden">
      {/* reveal layer behind the draggable content */}
      <div className="absolute inset-0 flex items-center justify-end rounded-lg bg-danger/15 pr-4" aria-hidden>
        <Trash2 size={16} className="text-danger" />
      </div>
      <motion.div
        ref={scope}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.x < -72) {
            void animate(scope.current, { x: -400, opacity: 0 }, { duration: 0.18 });
            void doDelete();
          }
        }}
        className="relative flex items-center justify-between gap-2 bg-surface-2 py-2"
      >
        <div className="min-w-0">
          <div className="truncate text-sm">
            {log.recipeId ? (
              <Link href={`/recipes/${log.recipeId}`} className="hover:text-accent">
                {log.name}
              </Link>
            ) : (
              log.name
            )}
            {log.servings !== 1 && <span className="text-text-tertiary"> × {log.servings}</span>}
          </div>
          <div className="text-[11px] tabular-nums text-text-tertiary">
            {Math.round(log.calories)} kcal · {Math.round(log.proteinG)}P {Math.round(log.carbsG)}C{" "}
            {Math.round(log.fatG)}F
          </div>
        </div>
        <button
          type="button"
          onClick={() => void doDelete()}
          className="px-1 text-text-tertiary transition hover:text-danger"
          aria-label="Remove"
        >
          <X size={15} />
        </button>
      </motion.div>
    </li>
  );
}
