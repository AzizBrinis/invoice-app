import clsx from "clsx";
import { useCisecoI18n } from "../../i18n";

type PillTabsProps = {
  items: string[];
  activeIndex: number;
  onSelect?: (index: number) => void;
};

export function PillTabs({ items, activeIndex, onSelect }: PillTabsProps) {
  const { t } = useCisecoI18n();
  return (
    <>
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const className = clsx(
          "inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-[12px] font-semibold tracking-[0.01em] transition-[transform,box-shadow,border-color,background-color,color] duration-200 sm:min-h-9 sm:px-3.5 sm:py-1.5",
          isActive
            ? "border-slate-900 bg-slate-900 text-white shadow-[0_14px_28px_-22px_rgba(15,23,42,0.78)]"
            : "border-black/10 bg-white/90 text-slate-600 hover:-translate-y-0.5 hover:border-black/15 hover:bg-white hover:text-slate-900 hover:shadow-[0_14px_28px_-24px_rgba(15,23,42,0.38)]",
        );
        if (!onSelect) {
          return (
            <span key={item} className={className}>
              {t(item)}
            </span>
          );
        }
        return (
          <button
            key={item}
            type="button"
            className={className}
            aria-pressed={isActive}
            onClick={() => onSelect(index)}
          >
            {t(item)}
          </button>
        );
      })}
    </>
  );
}
