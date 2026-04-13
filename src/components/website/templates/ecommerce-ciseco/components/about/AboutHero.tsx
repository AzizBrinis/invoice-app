import clsx from "clsx";
import type { ThemeTokens } from "../../types";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";

const TILE_OFFSETS = [
  "translate-y-3",
  "-translate-y-1",
  "-translate-y-4",
  "translate-y-2",
  "-translate-y-2",
];

type AboutHeroImage = {
  src: string;
  alt: string;
};

type AboutHeroProps = {
  theme: ThemeTokens;
  title: string;
  description: string;
  images: AboutHeroImage[];
  sectionId?: string;
};

export function AboutHero({
  theme,
  title,
  description,
  images,
  sectionId,
}: AboutHeroProps) {
  const { t } = useCisecoI18n();
  const resolvedImages = images.filter((image) => image.src.trim().length > 0);
  const hasImages = resolvedImages.length > 0;

  return (
    <Section theme={theme} id="about-hero" className="pt-8" builderSectionId={sectionId}>
      <div
        className={clsx(
          "relative overflow-hidden rounded-[36px] bg-gradient-to-br from-rose-50 via-white to-sky-50 shadow-sm",
          hasImages
            ? "px-6 py-10 sm:px-10 sm:py-12 lg:px-12"
            : "px-6 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-16 xl:px-16 xl:py-20",
        )}
      >
        {!hasImages ? (
          <>
            <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-rose-200/45 blur-3xl sm:h-52 sm:w-52" />
            <div className="pointer-events-none absolute bottom-0 left-6 h-32 w-32 rounded-full bg-sky-200/50 blur-3xl sm:h-44 sm:w-44" />
          </>
        ) : null}
        <div
          className={clsx(
            "relative",
            hasImages
              ? "grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center"
              : "flex min-h-[260px] items-center justify-center sm:min-h-[300px] lg:min-h-[340px]",
          )}
        >
          <div
            className={clsx(
              "space-y-4",
              hasImages
                ? "max-w-lg"
                : "mx-auto max-w-4xl space-y-5 text-center lg:space-y-6",
            )}
          >
            <h1
              className={clsx(
                "font-semibold text-slate-900",
                hasImages
                  ? "text-3xl sm:text-4xl lg:text-5xl"
                  : "text-4xl tracking-[-0.03em] sm:text-5xl lg:text-6xl",
              )}
            >
              {t(title)}
            </h1>
            <p
              className={clsx(
                "text-slate-600",
                hasImages
                  ? "text-sm sm:text-base"
                  : "mx-auto max-w-3xl text-base leading-7 sm:text-lg sm:leading-8",
              )}
            >
              {t(description)}
            </p>
          </div>
          {hasImages ? (
            <div className="flex justify-start lg:justify-end">
              <div className="flex flex-nowrap items-end gap-3 sm:gap-4">
                {resolvedImages.map((image, index) => (
                  <div
                    key={`${image.src}-${index}`}
                    className={clsx(
                      "h-20 w-11 flex-shrink-0 sm:h-28 sm:w-16 lg:h-36 lg:w-24",
                      TILE_OFFSETS[index % TILE_OFFSETS.length],
                    )}
                  >
                    <img
                      src={image.src}
                      alt={t(image.alt)}
                      className="h-full w-full rounded-2xl object-cover shadow-[0_16px_30px_-22px_rgba(15,23,42,0.45)]"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
