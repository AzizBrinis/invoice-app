import { Skeleton } from "@/components/ui/skeleton";

export function DashboardChartSkeleton() {
  return (
    <section className="card flex min-w-0 flex-col gap-6 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-64 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-8 w-32 max-w-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
      </div>
      <div
        className="relative mt-2 w-full min-w-0 overflow-hidden rounded-3xl border border-zinc-100 bg-white/60 dark:border-zinc-800 dark:bg-zinc-950/50"
        style={{ height: "clamp(280px, 60vw, 420px)" }}
      >
        <div className="absolute inset-0 flex items-end gap-3 px-6 pb-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <Skeleton className="h-full w-full rounded-t-xl" />
              </div>
              <Skeleton className="h-3 w-16 max-w-full" />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 px-6 pb-4">
          <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>
    </section>
  );
}
