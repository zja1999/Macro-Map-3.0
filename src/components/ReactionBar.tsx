"use client";

import { startTransition, useOptimistic } from "react";
import { motion } from "motion/react";
import { toggleReaction } from "@/actions/social";
import { toast } from "@/components/toast";
import { REACTION_KINDS } from "@/lib/utils";
import { CELEBRATE } from "@/lib/motion";

type Summary = { kind: string; count: number }[];
type ReactionState = { myReaction: string | null; summary: Summary };

/**
 * Optimistic reactions (plan §3.6): the ring + counts update instantly and the
 * server action settles in the background; revalidation reconciles the truth.
 * Class names (`ring-accent/40`) and emoji button names are load-bearing for
 * the e2e suite.
 */
export function ReactionBar({
  postId,
  myReaction,
  summary,
}: {
  postId: string;
  myReaction: string | null;
  summary: Summary;
}) {
  const [state, setOptimistic] = useOptimistic<ReactionState, string>(
    { myReaction, summary },
    (prev, kind) => {
      const next = new Map(prev.summary.map((s) => [s.kind, s.count]));
      const bump = (k: string, d: number) => next.set(k, Math.max(0, (next.get(k) ?? 0) + d));
      let mine: string | null;
      if (prev.myReaction === kind) {
        bump(kind, -1);
        mine = null;
      } else {
        if (prev.myReaction) bump(prev.myReaction, -1);
        bump(kind, 1);
        mine = kind;
      }
      return { myReaction: mine, summary: [...next].map(([k, count]) => ({ kind: k, count })) };
    },
  );

  const react = (kind: string) => {
    startTransition(async () => {
      setOptimistic(kind);
      try {
        const fd = new FormData();
        fd.set("postId", postId);
        fd.set("kind", kind);
        await toggleReaction(fd);
      } catch {
        toast("Couldn't save your reaction — try again", { tone: "error" });
      }
    });
  };

  const visible = state.summary
    .map((s) => ({ ...s, meta: REACTION_KINDS.find((r) => r.kind === s.kind) }))
    .filter((s) => s.count > 0)
    .sort(
      (a, b) =>
        REACTION_KINDS.findIndex((r) => r.kind === a.kind) - REACTION_KINDS.findIndex((r) => r.kind === b.kind),
    );

  return (
    <div className="flex items-center gap-0.5">
      {REACTION_KINDS.map((r) => {
        const active = state.myReaction === r.kind;
        return (
          <motion.button
            key={r.kind}
            type="button"
            title={r.label}
            onClick={() => react(r.kind)}
            animate={{ scale: active ? [1, 1.25, 1] : 1 }}
            transition={CELEBRATE}
            className={`rounded-md px-1.5 py-1 text-sm transition hover:bg-surface-1 ${
              active ? "bg-accent/15 ring-1 ring-accent/40" : "opacity-60 hover:opacity-100"
            }`}
          >
            {r.emoji}
          </motion.button>
        );
      })}
      {visible.length > 0 && (
        <div className="ml-2 flex items-center gap-1">
          {visible.map((r) => (
            <span
              key={r.kind}
              title={r.meta?.label ?? r.kind}
              className="rounded-full bg-surface-1 px-1.5 py-0.5 text-[11px] tabular-nums text-text-secondary"
            >
              {r.meta?.emoji ?? "•"} {r.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
