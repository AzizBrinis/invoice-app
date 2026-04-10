import clsx from "clsx";
import { useCisecoI18n } from "../../i18n";

type PaginationBarProps = {
  currentPage: number;
  pageCount: number;
  pages: Array<number | "ellipsis">;
  hrefForPage: (page: number) => string;
};

export function PaginationBar({
  currentPage,
  pageCount,
  pages,
  hrefForPage,
}: PaginationBarProps) {
  const { t } = useCisecoI18n();
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(pageCount, currentPage + 1);

  if (pageCount <= 1) {
    return null;
  }

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500">
      <a
        href={hrefForPage(previousPage)}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full px-2 py-1 text-slate-600 transition hover:text-slate-900",
          currentPage === 1 && "pointer-events-none text-slate-300",
        )}
        aria-disabled={currentPage === 1}
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        {t("Previous")}
      </a>
      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="flex h-8 w-8 items-center justify-center text-slate-300"
            >
              &hellip;
            </span>
          ) : (
            <a
              key={page}
              href={hrefForPage(page)}
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-full transition",
                page === currentPage
                  ? "border border-black/5 bg-slate-100 text-slate-900"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </a>
          ),
        )}
      </div>
      <a
        href={hrefForPage(nextPage)}
        className={clsx(
          "inline-flex items-center gap-2 rounded-full px-2 py-1 text-slate-600 transition hover:text-slate-900",
          currentPage === pageCount && "pointer-events-none text-slate-300",
        )}
        aria-disabled={currentPage === pageCount}
      >
        {t("Next")}
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

type IconProps = {
  className?: string;
};

function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M14.5 6.5L9 12l5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M9.5 6.5L15 12l-5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
