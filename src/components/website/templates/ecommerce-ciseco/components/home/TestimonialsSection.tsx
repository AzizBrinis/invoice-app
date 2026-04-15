import { type FocusEvent } from "react";
import clsx from "clsx";
import {
  resolveSectionCustomerPhotosVisibility,
  type WebsiteBuilderMediaAsset,
  type WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { CatalogPayload } from "@/server/website";
import { useAutoplayCarousel } from "../../hooks/useAutoplayCarousel";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";
import { CatalogImage } from "../shared/CatalogImage";

type TestimonialsSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  siteReviews?: CatalogPayload["siteReviews"];
};

export function TestimonialsSection({
  theme,
  section,
  mediaLibrary = [],
  siteReviews = [],
}: TestimonialsSectionProps) {
  const { t } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "What people are saying";
  const title = section?.title ?? "People love our products";
  const subtitle =
    section?.subtitle ??
    "Approved customer testimonials appear here once you publish them.";
  const testimonials = siteReviews.map((review, index) => {
    const builderItem = section?.items?.[index] ?? null;
    const asset = resolveBuilderMedia(builderItem?.mediaId, mediaLibrary);
    return {
      id: review.id,
      quote: review.body,
      name: review.authorName,
      role: review.authorRole ?? review.title ?? "",
      rating: review.rating,
      avatar: asset?.src ?? review.avatarUrl ?? "",
    };
  });
  const showCustomerPhotos = resolveSectionCustomerPhotosVisibility(section);
  const {
    activeIndex,
    hasControls,
    setIsPaused,
    goToIndex,
    goToNext,
    goToPrevious,
  } = useAutoplayCarousel({
    itemCount: testimonials.length,
    intervalMs: 5000,
  });
  const featured = testimonials[activeIndex] ?? null;
  const avatars = showCustomerPhotos
    ? testimonials
        .map((item) => item.avatar)
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsPaused(false);
    }
  };

  return (
    <Section
      theme={theme}
      id="testimonials"
      className="py-8 sm:py-10"
      builderSectionId={section?.id}
      deferRendering
      containIntrinsicSize="1px 640px"
    >
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <p className="ciseco-home-eyebrow">{t(eyebrow)}</p>
          <h2 className="ciseco-home-title text-[34px] sm:text-[42px]">
            {t(title)}
          </h2>
          <p className="ciseco-home-subtitle">
            {t(subtitle)}
          </p>
        </div>
        <div
          className="relative mx-auto max-w-[72rem]"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={handleBlurCapture}
        >
          {hasControls ? (
            <>
              <button
                type="button"
                aria-label={t("Previous testimonial")}
                className="absolute left-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.45)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:left-3 sm:h-10 sm:w-10 lg:left-4"
                onClick={goToPrevious}
              >
                <ArrowIcon direction="left" />
              </button>
              <button
                type="button"
                aria-label={t("Next testimonial")}
                className="absolute right-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-[0_14px_32px_-20px_rgba(15,23,42,0.45)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:right-3 sm:h-10 sm:w-10 lg:right-4"
                onClick={goToNext}
              >
                <ArrowIcon direction="right" />
              </button>
            </>
          ) : null}
          <div className="rounded-3xl bg-white/40 px-4 py-5 text-center shadow-[0_24px_60px_-40px_rgba(15,23,42,0.24)] sm:px-8 sm:py-6 lg:px-10 lg:py-7">
            {featured ? (
              <>
                <div
                  className={clsx(
                    "grid min-h-[15.5rem] place-items-center sm:min-h-[17rem] lg:min-h-[18.5rem]",
                    hasControls && "px-10 sm:px-14 lg:px-16",
                  )}
                >
                  {testimonials.map((testimonial, index) => {
                    const isActive = index === activeIndex;
                    const roundedRating = Math.max(
                      1,
                      Math.min(5, Math.round(testimonial.rating)),
                    );
                    return (
                      <article
                        key={testimonial.id}
                        aria-hidden={!isActive}
                        className={clsx(
                          "col-start-1 row-start-1 flex h-full w-full items-center justify-center transition-[opacity,transform] duration-500 ease-out",
                          isActive
                            ? "visible relative opacity-100 translate-y-0"
                            : "invisible pointer-events-none opacity-0 translate-y-2",
                        )}
                      >
                        <div className="mx-auto flex w-full max-w-[60rem] flex-col items-center justify-center text-center">
                          <div className="flex items-center justify-center gap-1 text-amber-500">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <svg
                                key={`${testimonial.id}-star-${starIndex}`}
                                viewBox="0 0 24 24"
                                className={clsx(
                                  "h-4 w-4 transition-opacity",
                                  starIndex < roundedRating
                                    ? "opacity-100"
                                    : "opacity-25",
                                )}
                                aria-hidden="true"
                              >
                                <path
                                  d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                                  fill="currentColor"
                                />
                              </svg>
                            ))}
                          </div>
                          <p className="mt-3 w-full text-[1.08rem] leading-7 text-slate-700 [font-family:var(--ciseco-font-display),var(--font-geist-sans),serif] [overflow-wrap:anywhere] [text-wrap:pretty] sm:text-[1.2rem] sm:leading-8 lg:text-[1.45rem] lg:leading-9">
                            &ldquo;{t(testimonial.quote)}&rdquo;
                          </p>
                          <div className="mt-4 ciseco-card-title text-[15px] text-slate-900 sm:text-base">
                            {t(testimonial.name)}
                          </div>
                          {testimonial.role ? (
                            <div className="mt-1 text-[13px] text-slate-500 [overflow-wrap:anywhere]">
                              {t(testimonial.role)}
                            </div>
                          ) : null}
                          <div className="mt-1 text-[12px] font-semibold text-slate-700">
                            {testimonial.rating.toFixed(1)}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {hasControls ? (
                  <div className="mt-5 flex items-center justify-center sm:mt-6">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {testimonials.map((testimonial, index) => (
                        <button
                          key={`${testimonial.id}-dot`}
                          type="button"
                          aria-label={`${t("Go to testimonial")} ${index + 1}`}
                          aria-current={index === activeIndex ? "true" : undefined}
                          onClick={() => goToIndex(index)}
                          className={clsx(
                            "rounded-full transition-all",
                            index === activeIndex
                              ? "h-2.5 w-8 bg-slate-900 sm:w-10"
                              : "h-2.5 w-2.5 bg-slate-300",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="mx-auto max-w-2xl py-4">
                <p className="text-[20px] leading-relaxed text-slate-700 [font-family:var(--ciseco-font-display),var(--font-geist-sans),serif] [overflow-wrap:anywhere]">
                  {t("No testimonials are published yet.")}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {t("Approved site reviews will appear here.")}
                </p>
              </div>
            )}
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

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d={direction === "left" ? "M14 7l-5 5 5 5" : "M10 7l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
