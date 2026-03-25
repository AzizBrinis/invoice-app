import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function ServicesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Spinner size="sm" label="Chargement…" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
        <Skeleton className="h-10 w-full sm:flex-1" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="card space-y-3 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Skeleton className="h-10 w-full sm:col-span-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="mt-4 flex justify-end">
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
