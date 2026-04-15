import { type FocusEvent } from "react";
import clsx from "clsx";
import { useAutoplayCarousel } from "../../hooks/useAutoplayCarousel";
import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";
import { CatalogImage } from "../shared/CatalogImage";

const ORBIT_POSITIONS = [
  "-left-6 top-10 hidden sm:block animate-[float_14s_ease-in-out_infinite]",
  "left-12 bottom-8 hidden sm:block animate-[float_12s_ease-in-out_infinite]",
  "right-8 top-6 hidden sm:block animate-[float_16s_ease-in-out_infinite]",
  "-right-6 bottom-12 hidden sm:block animate-[float_14s_ease-in-out_infinite]",
  "left-6 -bottom-6 hidden md:block animate-[float_12s_ease-in-out_infinite]",
  "right-24 -bottom-8 hidden md:block animate-[float_16s_ease-in-out_infinite]",
  "left-1/2 -top-8 hidden lg:block -translate-x-1/2 animate-[float_12s_ease-in-out_infinite]",
];

type OrbitAvatar = {
  id: string;
  image: string;
};

type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role?: string | null;
  rating: number;
  avatar?: string | null;
};

type TestimonialsOrbitProps = {
  theme: ThemeTokens;
  title: string;
  subtitle: string;
  testimonials: Testimonial[];
  showCustomerPhotos?: boolean;
  sectionId?: string;
  emptyMessage?: string;
};

export function TestimonialsOrbit({
  theme,
  title,
  subtitle,
  testimonials,
  showCustomerPhotos = true,
  sectionId,
  emptyMessage = "No testimonials are published yet.",
}: TestimonialsOrbitProps) {
  const { t } = useCisecoI18n();
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
  const testimonial = testimonials[activeIndex] ?? null;
  const showPrimaryPhoto = showCustomerPhotos && Boolean(testimonial?.avatar);
  const avatars: OrbitAvatar[] = showCustomerPhotos
    ? testimonials
        .filter((_, index) => index !== activeIndex)
        .map((item) =>
          item.avatar
            ? {
                id: item.id,
                image: item.avatar,
              }
            : null,
        )
        .filter((item): item is OrbitAvatar => Boolean(item))
        .slice(0, ORBIT_POSITIONS.length)
    : [];

  const handleBlurCapture = (event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsPaused(false);
    }
  };

  return (
    <Section theme={theme} id="testimonials" builderSectionId={sectionId}>
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
            {t(title)}
          </h2>
          <p className="mx-auto max-w-2xl text-sm text-slate-500 [overflow-wrap:anywhere] sm:text-base">
            {t(subtitle)}
          </p>
        </div>
        <div
          className={clsx(
            "relative mx-auto max-w-[72rem]",
            showCustomerPhotos ? "pt-10" : "pt-2",
          )}
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
          <div
            className={clsx(
              "relative rounded-3xl border border-black/5 bg-white px-4 text-center shadow-sm sm:px-8 lg:px-10",
              showPrimaryPhoto ? "pb-6 pt-10 sm:pb-7" : "py-6 sm:py-7",
            )}
          >
            {showPrimaryPhoto && testimonial?.avatar ? (
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-white shadow-sm">
                  <CatalogImage
                    src={testimonial.avatar}
                    alt={t(testimonial.name)}
                    className="h-full w-full object-cover"
                    width={64}
                    height={64}
                    loading="lazy"
                  />
                </div>
              </div>
            ) : null}
            <span
              aria-hidden="true"
              className="absolute left-6 top-6 text-4xl text-slate-200"
            >
              &ldquo;
            </span>
            <span
              aria-hidden="true"
              className="absolute bottom-12 right-6 text-4xl text-slate-200"
            >
              &rdquo;
            </span>
            {testimonial ? (
              <>
                <div
                  className={clsx(
                    "grid min-h-[12.5rem] place-items-center sm:min-h-[14rem] lg:min-h-[15rem]",
                    hasControls && "px-10 sm:px-14 lg:px-16",
                  )}
                >
                  {testimonials.map((item, index) => {
                    const isActive = index === activeIndex;
                    const roundedRating = Math.max(
                      1,
                      Math.min(5, Math.round(item.rating)),
                    );
                    return (
                      <article
                        key={item.id}
                        aria-hidden={!isActive}
                        className={clsx(
                          "col-start-1 row-start-1 flex h-full w-full items-center justify-center transition-[opacity,transform] duration-500 ease-out",
                          isActive
                            ? "visible relative opacity-100 translate-y-0"
                            : "invisible pointer-events-none opacity-0 translate-y-2",
                        )}
                      >
                        <div className="mx-auto flex w-full max-w-[58rem] flex-col items-center justify-center text-center">
                          <p className="w-full text-[0.98rem] leading-7 text-slate-700 [overflow-wrap:anywhere] [text-wrap:pretty] sm:text-[1.04rem] sm:leading-8 lg:text-[1.12rem]">
                            {t(item.quote)}
                          </p>
                          <p className="mt-3 text-sm font-semibold text-slate-900 sm:text-base">
                            {t(item.name)}
                          </p>
                          {item.role ? (
                            <p className="mt-1 text-sm text-slate-500 [overflow-wrap:anywhere]">
                              {t(item.role)}
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-center gap-1 text-amber-400">
                            {Array.from({ length: 5 }).map((_, starIndex) => (
                              <StarIcon
                                key={`${item.id}-star-${starIndex}`}
                                className={clsx(
                                  "h-4 w-4 transition-opacity",
                                  starIndex < roundedRating
                                    ? "opacity-100"
                                    : "opacity-25",
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-700 sm:text-base">
                {t(emptyMessage)}
              </p>
            )}
            {hasControls ? (
              <div className="mt-5 flex items-center justify-center sm:mt-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {testimonials.map((item, index) => (
                    <button
                      key={`${item.id}-dot`}
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
          </div>
          {showCustomerPhotos && avatars.length ? (
            <div className="pointer-events-none absolute inset-0">
              {avatars.map((avatar, index) => (
                <div
                  key={avatar.id}
                  className={clsx(
                    "absolute h-9 w-9 overflow-hidden rounded-full border-4 border-white shadow-sm sm:h-10 sm:w-10",
                    ORBIT_POSITIONS[index % ORBIT_POSITIONS.length],
                  )}
                >
                  <CatalogImage
                    src={avatar.image}
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

type IconProps = {
  className?: string;
};

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

function StarIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
