import { Skeleton } from "@/components/skeletons";

export default function DiscoverLoading() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }, (_, shelf) => (
        <div key={shelf}>
          <Skeleton className="mb-3 h-4 w-40" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }, (_, card) => (
              <Skeleton key={card} className="h-40 w-40 shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
