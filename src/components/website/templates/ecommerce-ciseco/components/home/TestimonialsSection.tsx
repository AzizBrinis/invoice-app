import clsx from "clsx";
import { TESTIMONIALS } from "../../data/home";
import {
  resolveSectionCustomerPhotosVisibility,
  type WebsiteBuilderMediaAsset,
  type WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";
import { CatalogImage } from "../shared/CatalogImage";

type TestimonialsSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

export function TestimonialsSection({
  theme,
  section,
  mediaLibrary = [],
}: TestimonialsSectionProps) {
  const { t } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "What people are saying";
  const title = section?.title ?? "People love our products";
  const subtitle =
    section?.subtitle ??
    "Neutral testimonials make it easy to preview social proof placement.";
  const testimonials =
    section?.items?.length
      ? section.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const fallback = TESTIMONIALS[index];
          return {
            id: item.id,
            quote: item.description ?? fallback?.quote ?? "",
            name: item.title ?? fallback?.name ?? "Customer",
            role: item.tag ?? fallback?.role ?? "",
            rating: fallback?.rating ?? 4.8,
            avatar: asset?.src ?? fallback?.avatar ?? "",
          };
        })
      : TESTIMONIALS;
  const showCustomerPhotos = resolveSectionCustomerPhotosVisibility(section);
  const [featured] = testimonials;
  const avatars = showCustomerPhotos
    ? testimonials
      .slice(0, 6)
      .map((item) => item.avatar)
      .filter(Boolean)
    : [];

  return (
    <Section
      theme={theme}
      id="testimonials"
      className="py-10 sm:py-12"
      builderSectionId={section?.id}
      deferRendering
      containIntrinsicSize="1px 720px"
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <h2 className="ciseco-home-title text-[34px] sm:text-[42px]">
            {t(title)}
          </h2>
          <p className="ciseco-home-subtitle">
            {t(subtitle)}
          </p>
        </div>
        <div className="relative mx-auto max-w-3xl">
          <div className="rounded-3xl bg-white/40 p-6 text-center sm:p-8">
            <div className="flex items-center justify-center gap-1 text-amber-500">
              {Array.from({ length: 5 }).map((_, index) => (
                <svg
                  key={`star-${index}`}
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                    fill="currentColor"
                  />
                </svg>
              ))}
            </div>
            <p className="mt-4 text-[24px] leading-relaxed text-slate-700 [font-family:var(--ciseco-font-display),var(--font-geist-sans),serif]">
              &ldquo;{t(featured.quote)}&rdquo;
            </p>
            <div className="mt-5 ciseco-card-title text-[15px] text-slate-900">
              {t(featured.name)}
            </div>
            <div className="text-[13px] text-slate-500">{t(featured.role)}</div>
            <div className="mt-1 text-[12px] font-semibold text-slate-700">
              {featured.rating.toFixed(1)}
            </div>
          </div>
          {avatars.length ? (
            <div className="pointer-events-none hidden sm:block">
              {avatars.map((avatar, index) => (
                <div
                  key={`${avatar}-${index}`}
                  className={clsx(
                    "absolute h-10 w-10 overflow-hidden rounded-full border-4 border-white shadow-sm",
                    index === 0 && "-left-2 top-8",
                    index === 1 && "left-10 -bottom-2",
                    index === 2 && "right-12 -bottom-3",
                    index === 3 && "-right-2 top-9",
                    index === 4 && "left-20 -top-2",
                    index === 5 && "right-24 -top-3",
                  )}
                >
                  <CatalogImage
                    src={avatar}
                    alt=""
                    className="h-full w-full object-cover"
                    width={40}
                    height={40}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
