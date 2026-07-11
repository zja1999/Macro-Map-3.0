import { cn } from "@/lib/utils";

/* Branded loading skeletons for route-level loading.tsx files (plan §3.6). */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

/** Ghost of a feed/content card. */
export function CardGhost() {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  );
}

/** Ghost of the macro-ring hero block. */
export function RingGhost() {
  return (
    <div className="flex items-center gap-6 rounded-xl border border-border bg-surface-2 p-4">
      <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-3 w-2/3 rounded-full" />
      </div>
    </div>
  );
}

/** Full-page skeleton: hero + card list. Default body for loading.tsx. */
export function PageGhost({ hero = false, cards = 3 }: { hero?: boolean; cards?: number }) {
  return (
    <div className="space-y-4">
      {hero && <RingGhost />}
      {Array.from({ length: cards }, (_, i) => (
        <CardGhost key={i} />
      ))}
    </div>
  );
}
