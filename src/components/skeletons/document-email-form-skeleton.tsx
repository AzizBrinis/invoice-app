import { Skeleton } from "@/components/ui/skeleton";

export function DocumentEmailFormSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-4 w-full sm:col-span-2" />
      <div className="sm:col-span-2 flex justify-end">
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}
