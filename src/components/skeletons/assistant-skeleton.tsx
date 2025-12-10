import { clsx } from "clsx";
import { Skeleton } from "@/components/ui/skeleton";

type AssistantSkeletonProps = {
  variant?: "page" | "panel";
};

export function AssistantSkeleton({ variant = "page" }: AssistantSkeletonProps) {
  return (
    <div
      className={clsx(
        "relative flex w-full max-w-full min-w-0 flex-col gap-6 overflow-x-hidden",
        variant === "panel"
          ? "h-full"
          : "min-h-[calc(100vh-220px)]",
      )}
    >
      <section
        className={clsx(
          "flex w-full max-w-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-br from-white via-blue-50/40 to-white shadow-2xl shadow-blue-500/10 transition dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-900",
          variant === "panel" ? "flex-1 min-h-0" : "min-h-[60vh]",
        )}
      >
        <div className="flex w-full min-w-0 flex-col gap-4 border-b border-white/60 px-4 py-4 backdrop-blur dark:border-zinc-800/80 sm:px-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-64" />
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-48 rounded-full" />
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 border-b border-white/60 px-4 py-4 dark:border-zinc-800/80 sm:px-6">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
        <div className="flex w-full flex-1 min-h-0 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 px-3 py-5 sm:px-4 sm:py-6 lg:px-6">
            <Skeleton className="h-16 w-5/6 rounded-2xl" />
            <Skeleton className="h-20 w-3/4 self-end rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
          <div className="w-full border-t border-zinc-200/70 bg-white/90 px-4 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-6">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Skeleton className="h-10 w-36 rounded-full" />
              <Skeleton className="h-10 w-28 rounded-full" />
              <Skeleton className="h-10 w-24 rounded-full" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
