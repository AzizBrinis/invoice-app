export function ProductsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-10 w-36 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="card grid gap-4 p-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-10 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {Array.from({ length: 6 }).map((_, rowIndex) => (
            <div
              key={rowIndex}
              className="grid grid-cols-8 gap-4 px-4 py-4 text-sm md:grid-cols-8"
            >
              {Array.from({ length: 8 }).map((__, colIndex) => (
                <div
                  key={colIndex}
                  className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
