import clsx from "clsx";
import type { ReactNode } from "react";

type AccordionItemProps = {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function AccordionItem({
  id,
  title,
  isOpen,
  onToggle,
  children,
}: AccordionItemProps) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`accordion-${id}`}
      >
        <span>{title}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-xs text-slate-500">
          {isOpen ? "-" : "+"}
        </span>
      </button>
      <div
        id={`accordion-${id}`}
        className={clsx(
          "overflow-hidden px-4 text-xs text-slate-600 transition-[max-height,opacity] duration-300",
          isOpen ? "max-h-56 pb-4 opacity-100" : "max-h-0 pb-0 opacity-0",
        )}
      >
        {children}
      </div>
    </div>
  );
}
