"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SHEET } from "@/lib/motion";

/**
 * iOS-style segmented control with a sliding active indicator.
 * Controlled: pass `value` + `onChange`. Used for feed scopes
 * (Following/Friends/Trending), Track↔Progress, food-search scopes.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const layoutId = useId();
  return (
    <div
      role="tablist"
      className={cn("flex rounded-full border border-border bg-surface-1 p-1", className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              active ? "text-black" : "text-text-secondary hover:text-text"
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SHEET}
                className="absolute inset-0 rounded-full bg-accent"
                aria-hidden
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
