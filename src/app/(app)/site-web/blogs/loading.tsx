export default function BlogsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-80 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`blogs-loading-stat-${index + 1}`}
            className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
      <div className="h-10 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={`blogs-loading-row-${index + 1}`}
            className="h-28 animate-pulse border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
    </div>
  );
}
