import clsx from "clsx";
import { Button } from "@/components/ui/button";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import { KIDS_PROMO_IMAGE } from "../../data/home";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { Section } from "../layout/Section";

type KidsOfferBannerProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
};

export function KidsOfferBanner({
  theme,
  section,
  mediaLibrary = [],
}: KidsOfferBannerProps) {
  const media = resolveBuilderMedia(section?.mediaId, mediaLibrary);
  const imageSrc = media?.src ?? KIDS_PROMO_IMAGE;
  const imageAlt = media?.alt ?? "Kids promotion";
  const eyebrow = section?.eyebrow?.trim() || "Special offer";
  const title = section?.title?.trim() || "Special offer in kids products";
  const description =
    section?.description?.trim() ||
    "Fashion is a form of self-expression and autonomy at a given period and place.";
  const primaryButton =
    section?.buttons?.find((button) => button.style === "primary") ??
    section?.buttons?.[0] ??
    null;
  const buttonLabel = primaryButton?.label?.trim() || "Discover more";
  const buttonHref = primaryButton?.href?.trim() || "#";

  return (
    <Section
      theme={theme}
      id="kids-offer"
      builderSectionId={section?.id}
    >
      <div className="relative overflow-hidden rounded-3xl bg-amber-50 px-6 py-8 sm:px-10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-8 top-6 h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <div className="absolute right-24 bottom-6 h-2 w-2 rounded-full bg-orange-400/80" />
          <div className="absolute left-10 top-10 h-2 w-2 rounded-full bg-sky-400/70" />
        </div>
        <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="order-2 lg:order-1">
            <div className="relative mx-auto w-full max-w-sm">
              <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-white shadow-sm">
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
          <div className="order-1 space-y-3 lg:order-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
              {eyebrow}
            </p>
            <h3 className="text-3xl font-semibold text-slate-900">
              {title}
            </h3>
            <p className="text-sm text-slate-600">
              {description}
            </p>
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "bg-slate-900 px-6 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] hover:opacity-90",
              )}
            >
              <a href={buttonHref}>{buttonLabel}</a>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
