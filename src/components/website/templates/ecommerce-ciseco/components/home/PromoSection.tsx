import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { PROMO_IMAGE } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { Section } from "../layout/Section";

type PromoSectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  homeHref: string;
};

export function PromoSection({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
}: PromoSectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Flexible callout";
  const title = section?.title ?? "Built for a wide range of use cases";
  const description =
    section?.description ??
    "Use this banner to highlight a feature, offer, announcement, or supporting message with neutral placeholder content.";
  const cta = section?.buttons?.[0];
  const promoMedia = resolveBuilderMedia(section?.mediaId, mediaLibrary);
  const promoImage = promoMedia?.src ?? PROMO_IMAGE;
  const promoAlt = promoMedia?.alt ?? "Promotional illustration";
  return (
    <Section
      theme={theme}
      id="promo"
      className="py-6 sm:py-7 lg:py-8"
      builderSectionId={section?.id}
    >
      <div className="grid items-center gap-6 rounded-[26px] bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-[1fr_1fr] lg:p-8">
        <div className="space-y-3">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <h3 className="ciseco-home-title max-w-[460px] text-[38px] sm:text-[46px]">
            {t(title)}
          </h3>
          <p className="ciseco-home-subtitle max-w-[460px]">
            {t(description)}
          </p>
          {cta ? (
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "mt-2 bg-slate-900 px-6 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-20px_rgba(15,23,42,0.45)]",
              )}
            >
              <a
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: cta.href,
                    homeHref,
                    fallbackPath: "/contact",
                  }),
                )}
              >
                {t(cta.label)}
              </a>
            </Button>
          ) : null}
        </div>
        <div className="relative mx-auto w-full max-w-[460px]">
          <div className="absolute -left-4 top-8 h-24 w-24 rounded-full bg-[#d7e8ff]" />
          <div className="absolute right-10 top-3 h-10 w-10 rounded-full bg-[#fed7aa]" />
          <img
            src={promoImage}
            alt={t(promoAlt)}
            className="relative z-10 h-auto w-full object-contain"
            loading="lazy"
          />
        </div>
      </div>
    </Section>
  );
}
