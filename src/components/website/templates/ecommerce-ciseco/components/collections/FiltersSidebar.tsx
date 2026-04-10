import clsx from "clsx";
import { useEffect, useState, type ReactNode } from "react";
import { useCisecoI18n } from "../../i18n";

export type FilterOption = {
  id: string;
  label: string;
  count: number;
  selected?: boolean;
  swatch?: string;
};

export type SortOption = {
  id: string;
  label: string;
  selected?: boolean;
};

type FiltersSidebarProps = {
  className?: string;
  collectionOptions: FilterOption[];
  colorOptions: FilterOption[];
  sizeOptions: FilterOption[];
  minPriceValue: string;
  maxPriceValue: string;
  hasActiveFilters: boolean;
  onSelectCollection: (collectionId: string | null) => void;
  onToggleColor: (colorId: string) => void;
  onToggleSize: (sizeId: string) => void;
  onApplyPrice: (minPrice: string, maxPrice: string) => void;
  onClearFilters: () => void;
};

export function FiltersSidebar({
  className,
  collectionOptions,
  colorOptions,
  sizeOptions,
  minPriceValue,
  maxPriceValue,
  hasActiveFilters,
  onSelectCollection,
  onToggleColor,
  onToggleSize,
  onApplyPrice,
  onClearFilters,
}: FiltersSidebarProps) {
  const { t } = useCisecoI18n();
  const [minPriceInput, setMinPriceInput] = useState(minPriceValue);
  const [maxPriceInput, setMaxPriceInput] = useState(maxPriceValue);

  useEffect(() => {
    setMinPriceInput(minPriceValue);
  }, [minPriceValue]);

  useEffect(() => {
    setMaxPriceInput(maxPriceValue);
  }, [maxPriceValue]);

  return (
    <aside className={clsx("space-y-6 text-sm text-slate-600", className)}>
      <div className="flex items-center justify-between gap-3 rounded-[28px] border border-black/5 bg-white/90 px-4 py-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.45)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t("Filters")}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {hasActiveFilters ? t("Showing filtered products") : t("Refine the catalog view")}
          </p>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900"
          >
            {t("Clear")}
          </button>
        ) : null}
      </div>

      <FilterSection title={t("Categories")}>
        <div className="space-y-2">
          {collectionOptions.map((option) => (
            <FilterToggle
              key={option.id}
              option={option}
              onClick={() =>
                onSelectCollection(option.id === "all" ? null : option.id)
              }
            />
          ))}
        </div>
      </FilterSection>

      {colorOptions.length ? (
        <FilterSection title={t("Colors")}>
          <div className="space-y-2">
            {colorOptions.map((option) => (
              <FilterToggle
                key={option.id}
                option={option}
                onClick={() => onToggleColor(option.id)}
              />
            ))}
          </div>
        </FilterSection>
      ) : null}

      {sizeOptions.length ? (
        <FilterSection title={t("Sizes")}>
          <div className="flex flex-wrap gap-2">
            {sizeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggleSize(option.id)}
                className={clsx(
                  "rounded-full border px-3 py-2 text-xs font-semibold transition",
                  option.selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-black/10 bg-white text-slate-600 hover:border-black/15 hover:text-slate-900",
                )}
              >
                {option.label}
                <span
                  className={clsx(
                    "ml-2 text-[10px]",
                    option.selected ? "text-white/80" : "text-slate-400",
                  )}
                >
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title={t("Price")}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onApplyPrice(minPriceInput, maxPriceInput);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs">
              <span className="text-[11px] text-slate-500">{t("Min price")}</span>
              <input
                inputMode="decimal"
                value={minPriceInput}
                onChange={(event) => setMinPriceInput(event.target.value)}
                placeholder="0"
                className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-[11px] text-slate-500">{t("Max price")}</span>
              <input
                inputMode="decimal"
                value={maxPriceInput}
                onChange={(event) => setMaxPriceInput(event.target.value)}
                placeholder="2000"
                className="w-full rounded-full border border-black/10 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
          </div>
          <button
            type="submit"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            {t("Apply")}
          </button>
        </form>
      </FilterSection>
    </aside>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-white/90 px-4 py-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.42)]">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function FilterToggle({
  option,
  onClick,
}: {
  option: FilterOption;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 text-left text-xs font-medium transition",
        option.selected
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-black/10 bg-white text-slate-700 hover:border-black/15 hover:text-slate-900",
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {option.swatch ? (
          <span
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: option.swatch }}
          />
        ) : null}
        <span className="truncate">{option.label}</span>
      </span>
      <span
        className={clsx(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
          option.selected
            ? "bg-white/15 text-white"
            : "bg-slate-100 text-slate-500",
        )}
      >
        {option.count}
      </span>
    </button>
  );
}
