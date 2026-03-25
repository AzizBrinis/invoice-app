import clsx from "clsx";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import { StarIcon } from "../shared/Icons";

export type CollectionProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  rating: number;
  reviewCount: number;
  image: string;
  colors: string[];
  badge?: string;
  favorite?: boolean;
  showActions?: boolean;
};

type ProductGridCardProps = {
  product: CollectionProduct;
};

export function ProductGridCard({ product }: ProductGridCardProps) {
  const imageSrc = product.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  return (
    <article className="group flex h-full flex-col">
      <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-white p-3 shadow-sm">
        <div className="relative overflow-hidden rounded-2xl bg-slate-50 p-6">
          <div className="aspect-square">
            <img
              src={imageSrc}
              alt={product.name}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          </div>
        </div>
        {product.badge ? (
          <span className="absolute left-4 top-4 z-10 inline-flex items-center rounded-full border border-black/10 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
            {product.badge}
          </span>
        ) : null}
        <button
          type="button"
          className={clsx(
            "absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition",
            product.favorite
              ? "text-rose-500"
              : "text-slate-400 hover:text-rose-500",
          )}
          aria-label="Toggle wishlist"
        >
          <HeartIcon className="h-4 w-4" filled={product.favorite} />
        </button>
        {product.showActions ? (
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-center gap-2 rounded-full bg-white/95 px-2 py-2 shadow-sm opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
            <button
              type="button"
              className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-semibold text-white"
            >
              Add to bag
            </button>
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold text-slate-600"
            >
              Quick view
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {product.colors.map((color, index) => (
          <span
            key={`${product.id}-color-${index}`}
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">
        {product.name}
      </h3>
      <p className="text-xs text-slate-500">{product.subtitle}</p>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="rounded-full border border-emerald-400 px-2 py-1 text-[11px] font-semibold text-emerald-600">
          {product.price}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <StarIcon className="h-3 w-3 text-amber-500" />
          <span className="font-semibold text-slate-700">
            {product.rating.toFixed(1)}
          </span>
          <span className="text-slate-400">
            ({product.reviewCount} reviews)
          </span>
        </div>
      </div>
    </article>
  );
}

type HeartIconProps = {
  className?: string;
  filled?: boolean;
};

function HeartIcon({ className, filled }: HeartIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20s-6.5-3.7-8.5-7.6C1.6 9.4 3.1 6 6.4 6c1.9 0 3.2 1 3.6 2.1C10.4 7 11.7 6 13.6 6c3.3 0 4.8 3.4 2.9 6.4C18.5 16.3 12 20 12 20z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
