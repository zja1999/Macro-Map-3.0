"use client";

import { useEffect } from "react";
import { maybeRequestReview } from "@/lib/review";

/**
 * Drop-in trigger for the in-app review nudge. Render it from a server component at a
 * positive moment, passing a stable `moment` key (e.g. `streak-14`, `pr-…`); pass null
 * to render nothing. All rate-limiting lives in maybeRequestReview — this just fires it.
 */
export function ReviewNudge({ moment }: { moment: string | null }) {
  useEffect(() => {
    if (moment) void maybeRequestReview(moment);
  }, [moment]);
  return null;
}
