import clsx from "clsx";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { StarIcon } from "../shared/Icons";

export type FeaturedProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  rating: number;
  reviewCount: number;
  image: string;
  thumbnails: string[];
};

type FeaturedRowProps = {
  theme: ThemeTokens;
  items: FeaturedProduct[];
};

export function FeaturedRow({ theme, items }: FeaturedRowProps) {
  const { t } = useCisecoI18n();
  return (
    <section className="border-t border-black/5">
      <div
        className={clsx(
          "mx-auto px-6 py-12 sm:px-8 sm:py-16 lg:py-20",
          theme.containerClass,
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {t("Chosen by experts.")}{" "}
            <span className="text-slate-400">{t("Featured of the week")}</span>
          </h2>
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 transition hover:text-slate-900"
              aria-label={t("Previous")}
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-slate-600 transition hover:text-slate-900"
              aria-label={t("Next")}
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {items.map((item) => (
            <FeaturedCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedCard({ item }: { item: FeaturedProduct }) {
  const { t } = useCisecoI18n();
  const imageSrc = item.image || WEBSITE_MEDIA_PLACEHOLDERS.products[0];
  const thumbnails =
    item.thumbnails.length > 0
      ? item.thumbnails
      : WEBSITE_MEDIA_PLACEHOLDERS.products.slice(0, 3);
  return (
    <article className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
      <div className="rounded-2xl bg-slate-50 p-6">
        <div className="aspect-square">
          <img
            src={imageSrc}
            alt={t(item.name)}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        {thumbnails.map((thumb, index) => (
          <div
            key={`${item.id}-thumb-${index}`}
            className="h-12 w-12 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-black/5"
          >
            <img
              src={thumb}
              alt={`${t(item.name)} ${t("thumbnail")} ${index + 1}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{t(item.name)}</h3>
          <p className="text-xs text-slate-500">{t(item.subtitle)}</p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
            <StarIcon className="h-3 w-3 text-amber-500" />
            <span className="font-semibold text-slate-700">
              {item.rating.toFixed(1)}
            </span>
            <span className="text-slate-400">
              ({item.reviewCount} {t("reviews")})
            </span>
          </div>
        </div>
        <span className="rounded-full border border-emerald-400 px-2 py-1 text-[11px] font-semibold text-emerald-600">
          {item.price}
        </span>
      </div>
    </article>
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
