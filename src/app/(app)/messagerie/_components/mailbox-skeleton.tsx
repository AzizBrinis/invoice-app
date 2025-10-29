"use client";

type MailboxSkeletonProps = {
  rows?: number;
};

export function MailboxSkeleton({ rows = 6 }: MailboxSkeletonProps) {
  return (
    <ul className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <li
          key={index}
          className="animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-2.5 w-44 rounded bg-zinc-200 dark:bg-zinc-700" />
            </div>
            <div className="h-2.5 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
          <div className="mt-3 h-2.5 w-full rounded bg-zinc-100 dark:bg-zinc-800" />
        </li>
      ))}
    </ul>
  );
}
