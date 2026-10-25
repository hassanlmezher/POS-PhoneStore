import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="border-b p-4">
          <Skeleton className="h-11 w-full sm:max-w-sm" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-28 sm:block" />
              <Skeleton className="ms-auto h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
