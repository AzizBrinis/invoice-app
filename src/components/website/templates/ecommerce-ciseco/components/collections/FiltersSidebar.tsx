import clsx from "clsx";

type FilterOption = {
  id: string;
  label: string;
  checked?: boolean;
};

type ColorOption = FilterOption & {
  swatch: string;
};

const CATEGORY_OPTIONS: FilterOption[] = [
  { id: "new-arrivals", label: "New Arrivals", checked: true },
  { id: "backpacks", label: "Backpacks" },
  { id: "travel-bags", label: "Travel Bags" },
  { id: "accessories", label: "Accessories" },
  { id: "t-shirts", label: "T-shirts" },
  { id: "hoodies", label: "Hoodies" },
];

const COLOR_OPTIONS: ColorOption[] = [
  { id: "beige", label: "Beige", swatch: "#e7d3bf", checked: true },
  { id: "blue", label: "Blue", swatch: "#3b82f6" },
  { id: "black", label: "Black", swatch: "#111827" },
  { id: "brown", label: "Brown", swatch: "#9a6b3b" },
  { id: "green", label: "Green", swatch: "#22c55e" },
];

const SIZE_OPTIONS: FilterOption[] = [
  { id: "xs", label: "XS", checked: true },
  { id: "s", label: "S" },
  { id: "m", label: "M" },
  { id: "l", label: "L" },
  { id: "xl", label: "XL" },
];

const SORT_OPTIONS: FilterOption[] = [
  { id: "popular", label: "Most Popular", checked: true },
  { id: "best-rating", label: "Best Rating" },
  { id: "newest", label: "Newest" },
  { id: "price-low-high", label: "Price Low - High" },
  { id: "price-high-low", label: "Price High - Low" },
];

type FiltersSidebarProps = {
  className?: string;
  categoryOptions?: FilterOption[];
};

export function FiltersSidebar({
  className,
  categoryOptions,
}: FiltersSidebarProps) {
  const categories =
    categoryOptions && categoryOptions.length > 0
      ? categoryOptions
      : CATEGORY_OPTIONS;
  return (
    <aside className={clsx("space-y-6 text-sm text-slate-600", className)}>
      <div className="space-y-4 border-b border-black/5 pb-6">
        <h3 className="text-sm font-semibold text-slate-900">Categories</h3>
        <div className="space-y-3">
          {categories.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                defaultChecked={option.checked}
                className="h-4 w-4 rounded border border-black/10 accent-slate-900"
              />
              <span className="text-slate-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-b border-black/5 pb-6">
        <h3 className="text-sm font-semibold text-slate-900">Colors</h3>
        <div className="space-y-3">
          {COLOR_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                defaultChecked={option.checked}
                className="h-4 w-4 rounded border border-black/10 accent-slate-900"
              />
              <span
                className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: option.swatch }}
              />
              <span className="text-slate-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-b border-black/5 pb-6">
        <h3 className="text-sm font-semibold text-slate-900">Sizes</h3>
        <div className="space-y-3">
          {SIZE_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                defaultChecked={option.checked}
                className="h-4 w-4 rounded border border-black/10 accent-slate-900"
              />
              <span className="text-slate-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-b border-black/5 pb-6">
        <h3 className="text-sm font-semibold text-slate-900">Price</h3>
        <div className="space-y-3">
          <input
            type="range"
            min="0"
            max="1000"
            defaultValue="350"
            className="h-1 w-full accent-slate-900"
            aria-label="Price range"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs">
              <span className="text-[11px] text-slate-500">Min price</span>
              <input
                type="text"
                defaultValue="$0"
                className="w-full rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-slate-600"
              />
            </label>
            <label className="grid gap-1 text-xs">
              <span className="text-[11px] text-slate-500">Max price</span>
              <input
                type="text"
                defaultValue="$1000"
                className="w-full rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs text-slate-600"
              />
            </label>
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Sort by</h3>
        <div className="space-y-3">
          {SORT_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="sort"
                defaultChecked={option.checked}
                className="h-4 w-4 accent-slate-900"
              />
              <span
                className={clsx(
                  "text-slate-700",
                  option.checked && "font-semibold text-slate-900",
                )}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
