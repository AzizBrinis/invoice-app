import { Skeleton } from "@/components/ui/skeleton";

export function ClientsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>
      <div className="card space-y-3 p-4 sm:flex sm:items-end sm:gap-4">
        <Skeleton className="h-10 w-full sm:flex-1" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Skeleton className="h-5 w-56" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={`clients-page-skeleton-${index}`} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
