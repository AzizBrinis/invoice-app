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

  return (
    <Section theme={theme} id="about-hero" className="pt-8" builderSectionId={sectionId}>
      <div className="rounded-[36px] bg-gradient-to-br from-rose-50 via-white to-sky-50 px-6 py-10 shadow-sm sm:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center">
          <div className="max-w-lg space-y-4">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl lg:text-5xl">
              {t(title)}
            </h1>
            <p className="text-sm text-slate-600 sm:text-base">
              {t(description)}
            </p>
          </div>
          {images.length ? (
            <div className="flex justify-start lg:justify-end">
              <div className="flex flex-nowrap items-end gap-3 sm:gap-4">
                {images.map((image, index) => (
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
