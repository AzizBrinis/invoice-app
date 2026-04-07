import { DISCOVERY_CARDS } from "../../data/home";
import type {
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { ThemeTokens } from "../../types";
import { resolveBuilderMedia } from "../../builder-helpers";
import { resolveCisecoNavigationHref } from "../../utils";
import { useCisecoI18n } from "../../i18n";
import { Reveal } from "../shared/Reveal";
import { Section } from "../layout/Section";

type DiscoverySectionProps = {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary?: WebsiteBuilderMediaAsset[];
  homeHref: string;
};

export function DiscoverySection({
  theme,
  section,
  mediaLibrary = [],
  homeHref,
}: DiscoverySectionProps) {
  const { t, localizeHref } = useCisecoI18n();
  const eyebrow = section?.eyebrow ?? "Discover more";
  const title = section?.title ?? "Adaptable blocks for a clean start";
  const subtitle =
    section?.subtitle ??
    "Neutral placeholder content keeps the layout reusable across industries.";
  const baseCards =
    section?.items?.length
      ? section.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const fallback = DISCOVERY_CARDS[index];
          return {
            id: item.id,
            title: item.title ?? fallback?.title ?? "Discover",
            description: item.description ?? fallback?.description ?? "",
            image: asset?.src ?? fallback?.image ?? "",
            cta: item.linkLabel ?? fallback?.cta ?? "Explore",
            href: item.href ?? fallback?.href ?? "#",
          };
        })
      : DISCOVERY_CARDS;
  const cards = (() => {
    if (baseCards.length >= 4) return baseCards.slice(0, 4);
    if (!baseCards.length) return [];
    const extended = [...baseCards];
    let index = 0;
    while (extended.length < 4) {
      const next = baseCards[index % baseCards.length];
      extended.push({
        ...next,
        id: `${next.id}-extra-${index}`,
      });
      index += 1;
    }
    return extended;
  })();
  const tones = [
    "bg-[#f6f2e8]",
    "bg-[#f1f3f9]",
    "bg-[#eef3ec]",
    "bg-[#f3f1f8]",
  ];
  return (
    <Section
      theme={theme}
      id="discover"
      className="py-5 sm:py-6 lg:py-7"
      builderSectionId={section?.id}
    >
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <p className="ciseco-home-eyebrow">
            {t(eyebrow)}
          </p>
          <a
            href={localizeHref(
              resolveCisecoNavigationHref({
                homeHref,
                fallbackPath: "/collections",
              }),
            )}
            aria-label={t("More discovery cards")}
            className="hidden text-sm text-slate-500 lg:inline-flex"
          >
            →
          </a>
        </div>
        <h2 className="ciseco-home-title text-[34px] sm:text-[42px]">
          {t(title)}
        </h2>
        <p className="ciseco-home-subtitle">
          {t(subtitle)}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card, index) => (
            <Reveal key={card.id} delay={index * 50}>
              <a
                href={localizeHref(
                  resolveCisecoNavigationHref({
                    href: card.href,
                    homeHref,
                    fallbackPath: DISCOVERY_CARDS[index]?.href ?? "/collections",
                  }),
                )}
                className={`group grid h-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tones[index % tones.length]}`}
              >
                <div className="space-y-2">
                  <p className="ciseco-card-title text-[15px] leading-tight text-slate-900">
                    {t(card.title)}
                  </p>
                  <p className="line-clamp-2 text-[13px] leading-6 text-slate-500">
                    {t(card.description)}
                  </p>
                  <span className="inline-flex rounded-full bg-black px-3 py-1 text-[11px] font-semibold tracking-[0.02em] text-white">
                    {t(card.cta)}
                  </span>
                </div>
                <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-white/70 sm:h-24 sm:w-24">
                  <img
                    src={card.image}
                    alt={t(card.title)}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
