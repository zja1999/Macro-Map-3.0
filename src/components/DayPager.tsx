"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/overlays";
import { todayStr, shiftDate, formatDateLabel } from "@/lib/utils";

/**
 * Track's date header (plan §4.5): arrow paging, horizontal swipe anywhere on
 * the header, and a calendar sheet on tap. Future dates are unreachable.
 */
export function DayPager({ date }: { date: string }) {
  const router = useRouter();
  const [calOpen, setCalOpen] = useState(false);
  const touchX = useRef<number | null>(null);
  const today = todayStr();
  const atToday = date >= today;

  const go = (d: string) => router.push(`/track?date=${d}`);

  return (
    <div
      className="flex items-center justify-between"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx > 60) go(shiftDate(date, -1));
        else if (dx < -60 && !atToday) go(shiftDate(date, 1));
      }}
    >
      <button
        type="button"
        onClick={() => go(shiftDate(date, -1))}
        aria-label="Previous day"
        className="rounded-lg border border-border bg-surface-2 p-2 text-text-secondary transition hover:text-text active:scale-95"
      >
        <ChevronLeft size={18} />
      </button>

      <Sheet
        open={calOpen}
        onOpenChange={setCalOpen}
        title="Jump to date"
        trigger={
          <button type="button" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-base font-bold transition hover:bg-surface-2">
            {formatDateLabel(date)}
            <CalendarDays size={15} className="text-text-tertiary" />
          </button>
        }
      >
        <div className="space-y-3 pb-2">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              if (e.target.value) {
                setCalOpen(false);
                go(e.target.value);
              }
            }}
            className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
          />
          {date !== today && (
            <button
              type="button"
              onClick={() => {
                setCalOpen(false);
                go(today);
              }}
              className="w-full rounded-lg bg-accent/10 px-3 py-2.5 text-sm font-semibold text-accent transition hover:bg-accent/20"
            >
              Back to today
            </button>
          )}
        </div>
      </Sheet>

      {atToday ? (
        <span className="w-[38px]" aria-hidden />
      ) : (
        <button
          type="button"
          onClick={() => go(shiftDate(date, 1))}
          aria-label="Next day"
          className="rounded-lg border border-border bg-surface-2 p-2 text-text-secondary transition hover:text-text active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}
