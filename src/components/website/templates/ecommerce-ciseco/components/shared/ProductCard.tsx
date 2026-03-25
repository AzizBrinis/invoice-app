import clsx from "clsx";
import type { ProductCardData } from "../../types";

type ProductCardProps = {
  product: ProductCardData;
  variant?: "default" | "compact";
  href?: string;
  onAddToCart?: () => void;
};

type ProductCardSkeletonProps = {
  variant?: "default" | "compact";
};

export function ProductCard({
  product,
  variant = "default",
  href,
  onAddToCart,
}: ProductCardProps) {
  const isCompact = variant === "compact";
  return (
    <article
      className={clsx(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/8 bg-white p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        isCompact && "p-2",
      )}
    >
      {href ? (
        <a
          href={href}
          className="absolute inset-0 z-10"
          aria-label={`View ${product.name}`}
        />
      ) : null}
      <div className="relative overflow-hidden rounded-2xl bg-slate-100">
        <div className={clsx(isCompact ? "aspect-square" : "aspect-square")}>
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
        {product.badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-emerald-600">
            {product.badge}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`Save ${product.name}`}
          className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-xs text-slate-700 shadow-sm"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 20s-6.5-3.7-8.5-7.6C1.6 9.4 3.1 6 6.4 6c1.9 0 3.2 1 3.6 2.1C10.4 7 11.7 6 13.6 6c3.3 0 4.8 3.4 2.9 6.4C18.5 16.3 12 20 12 20z"
              fill="currentColor"
              opacity="0.2"
            />
            <path
              d="M12 20s-6.5-3.7-8.5-7.6C1.6 9.4 3.1 6 6.4 6c1.9 0 3.2 1 3.6 2.1C10.4 7 11.7 6 13.6 6c3.3 0 4.8 3.4 2.9 6.4C18.5 16.3 12 20 12 20z"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </button>
      </div>
      <div className={clsx("flex flex-1 flex-col", isCompact ? "mt-2" : "mt-2.5")}>
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          <span>{product.category}</span>
          <span className="text-slate-900">{product.price}</span>
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-tight text-slate-900">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500">
              <path
                d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                fill="currentColor"
              />
            </svg>
            <span>{product.rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1">
            {product.colors.map((color, colorIndex) => (
              <span
                key={`${product.id}-color-${colorIndex}`}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="relative z-20 mt-2 flex items-center justify-between gap-2">
          <a
            href={href ?? "#"}
            className="text-xs font-semibold text-slate-700"
          >
            Shop now
          </a>
          {!isCompact && onAddToCart ? (
            <button
              type="button"
              onClick={onAddToCart}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-black/5"
            >
              Add to bag
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton({
  variant = "default",
}: ProductCardSkeletonProps) {
  const isCompact = variant === "compact";
  return (
    <div
      className={clsx(
        "flex h-full animate-pulse flex-col overflow-hidden rounded-2xl border border-black/8 bg-white p-2.5 shadow-sm",
        isCompact && "p-2",
      )}
    >
      <div className="relative overflow-hidden rounded-2xl bg-slate-50">
        <div
          className={clsx(
            "bg-slate-100",
            isCompact ? "aspect-square" : "aspect-square",
          )}
        />
      </div>
      <div className={clsx("flex flex-1 flex-col", isCompact ? "mt-2" : "mt-2.5")}>
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 rounded-full bg-slate-100" />
          <div className="h-3 w-12 rounded-full bg-slate-100" />
        </div>
        <div className="mt-1.5 h-4 w-32 rounded-full bg-slate-100" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-3 w-16 rounded-full bg-slate-100" />
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-100" />
            <span className="h-2 w-2 rounded-full bg-slate-100" />
            <span className="h-2 w-2 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="h-3 w-16 rounded-full bg-slate-100" />
          {!isCompact ? <div className="h-5 w-20 rounded-full bg-slate-100" /> : null}
        </div>
      </div>
    </div>
  );
}
