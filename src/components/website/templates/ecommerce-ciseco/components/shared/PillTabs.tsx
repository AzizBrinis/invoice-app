import clsx from "clsx";

type PillTabsProps = {
  items: string[];
  activeIndex: number;
  onSelect?: (index: number) => void;
};

export function PillTabs({ items, activeIndex, onSelect }: PillTabsProps) {
  return (
    <>
      {items.map((item, index) => {
        const isActive = index === activeIndex;
        const className = clsx(
          "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition sm:text-xs",
          isActive
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-black/10 bg-white text-slate-600 hover:border-black/20 hover:text-slate-800",
        );
        if (!onSelect) {
          return (
            <span key={item} className={className}>
              {item}
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
            {item}
          </button>
        );
      })}
    </>
  );
}
