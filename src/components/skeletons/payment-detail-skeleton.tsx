import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function PaymentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Spinner size="sm" label="Chargement…" />
      </div>

      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-40" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="card space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="card space-y-4 p-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, sectionIndex) => (
            <section key={sectionIndex} className="card space-y-4 p-5">
              <div className="space-y-2">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Skeleton className="h-10 w-36" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
              <div className="space-y-3">
                {sectionIndex === 1
                  ? Array.from({ length: 2 }).map((__, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </div>
                        <Skeleton className="mt-3 h-4 w-full" />
                      </div>
                    ))
                  : null}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
