import clsx from "clsx";
import { Button } from "@/components/ui/button";
import { KIDS_PROMO_IMAGE } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { Section } from "../layout/Section";

type KidsPromoBannerProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

export function KidsPromoBanner({
  theme,
  section,
  mediaLibrary = [],
}: KidsPromoBannerProps) {
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
              alt={imageAlt}
              className="h-auto w-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-900">
              {eyebrow}
            </p>
            <h3 className="max-w-[360px] text-[34px] font-semibold leading-tight text-slate-900">
              {title}
            </h3>
            <p className="max-w-[360px] text-sm text-slate-600">
              {subtitle}
            </p>
            {cta ? (
              <Button
                asChild
                className={clsx(
                  theme.buttonShape,
                  "bg-slate-900 px-6 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] hover:opacity-90",
                )}
              >
                <a href={cta.href ?? "#"}>{cta.label}</a>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </Section>
  );
}
