import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <Spinner size="sm" label="Chargement…" />
      </div>
      <section className="space-y-4">
        <Skeleton className="h-6 w-48 max-w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="card flex min-w-0 flex-col gap-3 p-5"
            >
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-8 w-24 max-w-full" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </section>

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
              <div
                key={index}
                className="flex flex-1 flex-col items-center gap-2"
              >
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="card flex min-w-0 flex-col p-5">
            <Skeleton className="h-5 w-48 max-w-full" />
            <div className="mt-4 hidden md:block">
              <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="border-b border-zinc-200 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <tr>
                      {Array.from({ length: 5 }).map((__, colIndex) => (
                        <th key={colIndex} className="px-3 py-2">
                          <Skeleton className="h-3 w-20 max-w-full" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {Array.from({ length: 5 }).map((__, rowIndex) => (
                      <tr key={rowIndex}>
                        {Array.from({ length: 4 }).map((___, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2">
                            <Skeleton className="h-4 w-24 max-w-full" />
                          </td>
                        ))}
                        <td className="px-3 py-2">
                          <Skeleton className="h-5 w-20 max-w-full rounded-full" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-4 space-y-3 md:hidden">
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <div
                  key={rowIndex}
                  className="rounded-xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-950/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-24 max-w-full" />
                      <Skeleton className="h-3 w-32 max-w-full" />
                    </div>
                    <Skeleton className="h-5 w-20 max-w-full" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Skeleton className="h-3 w-16 max-w-full" />
                    <Skeleton className="h-4 w-20 max-w-full rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
