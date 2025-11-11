import { clsx } from "clsx";

type SkeletonProps = {
  className?: string;
};

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800",
        className,
      )}
    />
  );
}

export function WebsiteContentFormSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-11 w-32 self-end" />
    </div>
  );
}

export function DomainCardSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function PublishCardSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <Skeleton className="h-5 w-1/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-28" />
      </div>
    </div>
  );
}

export function ProductSummaryCardSkeleton() {
  return (
    <div className="card space-y-4 p-6">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-36" />
    </div>
  );
}
