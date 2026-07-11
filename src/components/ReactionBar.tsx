"use client";

import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import { motion } from "motion/react";
import { toggleReaction } from "@/actions/social";
import { toast } from "@/components/toast";
import { REACTION_KINDS } from "@/lib/utils";

type Summary = { kind: string; count: number }[];
type ReactionState = { myReaction: string | null; summary: Summary };

export function ReactionBar({ postId, myReaction, summary }: { postId: string; myReaction: string | null; summary: Summary }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldOpen = useRef(false);
  const [state, setOptimistic] = useOptimistic<ReactionState, string>(
    { myReaction, summary },
    (prev, kind) => {
      const next = new Map(prev.summary.map((item) => [item.kind, item.count]));
      const bump = (key: string, amount: number) => next.set(key, Math.max(0, (next.get(key) ?? 0) + amount));
      let mine: string | null;
      if (prev.myReaction === kind) {
        bump(kind, -1);
        mine = null;
      } else {
        if (prev.myReaction) bump(prev.myReaction, -1);
        bump(kind, 1);
        mine = kind;
      }
      return { myReaction: mine, summary: [...next].map(([key, count]) => ({ kind: key, count })) };
    },
  );

  const visible = state.summary
    .map((item) => ({ ...item, meta: REACTION_KINDS.find((reaction) => reaction.kind === item.kind) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => REACTION_KINDS.findIndex((r) => r.kind === a.kind) - REACTION_KINDS.findIndex((r) => r.kind === b.kind));
  const current = REACTION_KINDS.find((reaction) => reaction.kind === state.myReaction);
  const total = visible.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const react = (kind: string) => {
    setPickerOpen(false);
    startTransition(async () => {
      setOptimistic(kind);
      try {
        const formData = new FormData();
        formData.set("postId", postId);
        formData.set("kind", kind);
        await toggleReaction(formData);
      } catch {
        toast("Couldn't save your reaction — try again", { tone: "error" });
      }
    });
  };

  return (
    <div ref={rootRef} className="relative flex min-w-0 items-center gap-2">
      {pickerOpen && (
        <div role="menu" aria-label="Choose a reaction" className="absolute bottom-full left-0 z-20 mb-2 flex rounded-full border border-border bg-surface-1 p-1.5 shadow-xl">
          {REACTION_KINDS.map((reaction) => (
            <motion.button
              key={reaction.kind}
              type="button"
              role="menuitem"
              title={reaction.label}
              aria-label={reaction.label}
              onClick={() => react(reaction.kind)}
              whileHover={{ scale: 1.25, y: -3 }}
              whileTap={{ scale: 0.9 }}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xl ${state.myReaction === reaction.kind ? "bg-accent/15 ring-1 ring-accent/40" : "hover:bg-surface-3"}`}
            >
              {reaction.emoji}
            </motion.button>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
        aria-label={current ? `${current.label} reaction. Hold for more reactions.` : "React. Hold for more reactions."}
        onPointerDown={() => {
          heldOpen.current = false;
          holdTimer.current = setTimeout(() => {
            heldOpen.current = true;
            setPickerOpen(true);
          }, 450);
        }}
        onPointerUp={() => {
          stopHold();
          if (!heldOpen.current) react(current?.kind ?? "like");
        }}
        onPointerCancel={stopHold}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setPickerOpen(true);
          }
        }}
        className={`flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${current ? "bg-accent/10 text-accent" : "text-ink-faint hover:bg-surface-1 hover:text-ink"}`}
      >
        <span className="text-base">{current?.emoji ?? "♡"}</span>
        <span>{current?.label ?? "React"}</span>
      </button>
      {total > 0 && (
        <span className="truncate text-[11px] text-ink-faint" title={visible.map((item) => `${item.meta?.label}: ${item.count}`).join(", ")}>
          {visible.slice(0, 3).map((item) => item.meta?.emoji).join("")} {total}
        </span>
      )}
    </div>
  );
}
