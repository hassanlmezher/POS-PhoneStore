import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-11 w-56 rounded-lg" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
