import clsx from "clsx";

type RouteLoadingShellProps = {
  className?: string;
};

export function RouteLoadingShell({ className }: RouteLoadingShellProps) {
  return (
    <div
      className={clsx(
        "min-h-screen bg-[var(--ciseco-bg,#f5f6f7)] text-slate-900",
        className,
      )}
    >
      <div className="border-b border-black/5 bg-white">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between gap-4 px-6 lg:px-8">
          <div className="h-7 w-40 animate-pulse rounded-full bg-slate-200" />
          <div className="hidden items-center gap-4 lg:flex">
            <div className="h-4 w-14 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
            <div className="h-10 w-20 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1240px] px-6 pb-16 pt-10 sm:px-8 lg:px-8 lg:pb-20 lg:pt-12">
        <div className="max-w-3xl space-y-4">
          <div className="h-3 w-28 animate-pulse rounded-full bg-emerald-100" />
          <div className="h-11 w-72 animate-pulse rounded-full bg-slate-200" />
          <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-slate-200" />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`route-loading-card-${index + 1}`}
              className="animate-pulse overflow-hidden rounded-[28px] border border-black/5 bg-white/95 p-3.5 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.35)]"
            >
              <div className="aspect-square rounded-[24px] bg-slate-100" />
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="h-3 w-20 rounded-full bg-slate-100" />
                <div className="h-8 w-20 rounded-full bg-slate-100" />
              </div>
              <div className="mt-3 h-5 w-36 rounded-full bg-slate-100" />
              <div className="mt-2 h-4 w-24 rounded-full bg-slate-100" />
              <div className="mt-6 h-10 w-full rounded-full bg-slate-100" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
