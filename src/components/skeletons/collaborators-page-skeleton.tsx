import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function CollaboratorsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Spinner size="sm" label="Chargement…" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="card space-y-4 p-5">
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-10 w-40" />
          </div>
        </section>

        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, sectionIndex) => (
            <section key={sectionIndex} className="card space-y-4 p-5">
              <Skeleton className="h-5 w-52" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((__, rowIndex) => (
                  <div
                    key={rowIndex}
                    className="rounded-xl border border-zinc-200/80 bg-white/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Skeleton className="h-6 w-28 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-32 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
