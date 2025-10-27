import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Spinner size="sm" label="Chargement…" />
      </div>
      <section>
        <Skeleton className="h-6 w-48" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card space-y-3 p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <Skeleton className="h-5 w-64" />
        <div className="mt-6 flex h-48 items-end gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <Skeleton className="h-full w-full rounded-t-lg" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="card p-5">
            <Skeleton className="h-5 w-48" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((__, row) => (
                <div
                  key={row}
                  className="flex items-center justify-between rounded-lg border border-transparent px-3 py-2"
                >
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
