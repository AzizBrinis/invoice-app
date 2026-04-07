import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { KIDS_PROMO_IMAGE } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";

type KidsPromoBannerProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  homeHref: string;
};

export function KidsPromoBanner({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
}: KidsPromoBannerProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Featured highlight";
  const title = section?.title ?? "Highlight an announcement or offer";
  const subtitle =
    section?.subtitle ??
    "This banner works for seasonal messages, launches, or any temporary spotlight.";
  const cta = section?.buttons?.[0];
  const media = resolveBuilderMedia(section?.mediaId, mediaLibrary);
  const image = media?.src ?? KIDS_PROMO_IMAGE;
  const imageAlt = media?.alt ?? "Banner illustration";
  return (
    <Section
      theme={theme}
      id="kids-promo"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="overflow-hidden rounded-[26px] bg-[#f4f0dc] px-4 py-4 sm:px-6 sm:py-5">
        <div className="grid items-center gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative mx-auto w-full max-w-[360px]">
            <img
              src={image}
              alt={t(imageAlt)}
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="space-y-3">
            <p className="ciseco-home-eyebrow">
              {t(eyebrow)}
            </p>
            <h3 className="ciseco-home-title max-w-[360px] text-[38px] sm:text-[46px]">
              {t(title)}
            </h3>
            <p className="ciseco-home-subtitle max-w-[360px]">
              {t(subtitle)}
            </p>
            {cta ? (
              <Button
                asChild
                className={clsx(
                  theme.buttonShape,
                  "bg-slate-900 px-6 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-20px_rgba(15,23,42,0.45)]",
                )}
              >
                <a
                  href={localizeHref(
                    resolveCisecoNavigationHref({
                      href: cta.href,
                      homeHref,
                      fallbackPath: "/about",
                    }),
                  )}
                >
                  {t(cta.label)}
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
