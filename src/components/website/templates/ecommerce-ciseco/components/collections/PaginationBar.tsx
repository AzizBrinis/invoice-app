export function PaginationBar() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Previous
      </a>
      <div className="flex items-center gap-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 bg-slate-100 text-xs font-semibold text-slate-900">
          1
        </span>
        <a
          href="#"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          2
        </a>
        <a
          href="#"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          3
        </a>
        <a
          href="#"
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          4
        </a>
      </div>
      <a
        href="#"
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        Next
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
