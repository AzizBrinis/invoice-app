import type { ReactNode } from "react";
import { useCisecoI18n } from "../../i18n";

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
  const { t } = useCisecoI18n();
  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-900"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`accordion-${id}`}
      >
        <span>{t(title)}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-xs text-slate-600">
          {isOpen ? "-" : "+"}
        </span>
      </button>
      <div
        id={`accordion-${id}`}
        hidden={!isOpen}
        className="px-4 pb-4 text-xs text-slate-600"
      >
        {isOpen ? children : null}
      </div>
    </div>
  );
}
