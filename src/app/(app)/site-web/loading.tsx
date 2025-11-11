import {
  DomainCardSkeleton,
  ProductSummaryCardSkeleton,
  PublishCardSkeleton,
  WebsiteContentFormSkeleton,
} from "@/app/(app)/site-web/_components/site-web-skeletons";

export default function SiteWebLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800" />
          <div className="h-4 w-80 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-200/70 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800" />
            <div className="mt-3 h-6 w-1/2 animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800" />
          </div>
        ))}
      </div>

      <WebsiteContentFormSkeleton />

      <div className="grid gap-6 lg:grid-cols-2">
        <DomainCardSkeleton />
        <PublishCardSkeleton />
      </div>

      <ProductSummaryCardSkeleton />
    </div>
  );
}
