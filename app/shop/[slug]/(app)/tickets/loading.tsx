import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-11 w-44" />
        <Skeleton className="h-11 w-72" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/40 p-2">
            <Skeleton className="m-1 h-5 w-28" />
            {Array.from({ length: 3 - (i % 2) }, (_, j) => (
              <Skeleton key={j} className="h-28 rounded-lg bg-card" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
