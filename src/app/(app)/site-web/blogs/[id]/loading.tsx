export default function BlogPostDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-72 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-64 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`blog-post-loading-stat-${index + 1}`}
            className="h-24 animate-pulse rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          />
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={`blog-post-loading-line-${index + 1}`}
            className="h-4 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}
