import clsx from "clsx";
import type { CSSProperties } from "react";
import type {
  WebsiteBuilderSection,
  WebsiteBuilderPageConfig,
} from "@/lib/website/builder";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type { CatalogPayload } from "@/server/website";
import type { ThemeTokens } from "../types";
import {
  resolveBuilderMedia,
  resolveBuilderSectionBySignature,
} from "../builder-helpers";
import { AboutHero } from "../components/about/AboutHero";
import { FastFacts } from "../components/about/FastFacts";
import { FounderGrid } from "../components/about/FounderGrid";
import { PromoBlock } from "../components/about/PromoBlock";
import { TestimonialsOrbit } from "../components/about/TestimonialsOrbit";
import { ExtraSections } from "../components/builder/ExtraSections";
import { Footer } from "../components/layout/Footer";
import { Navbar } from "../components/layout/Navbar";
import { PageShell } from "../components/layout/PageShell";
import { resolveSectionCustomerPhotosVisibility } from "@/lib/website/builder";
import {
  ABOUT_FAST_FACTS,
  ABOUT_FAST_FACTS_COPY,
  ABOUT_FOUNDERS,
  ABOUT_FOUNDERS_COPY,
  ABOUT_HERO_COPY,
  ABOUT_HERO_IMAGES,
  ABOUT_PROMO_COPY,
  ABOUT_PROMO_ILLUSTRATION,
  ABOUT_TESTIMONIALS_COPY,
} from "../data/about";

type AboutPageProps = {
  theme: ThemeTokens;
  inlineStyles: CSSProperties;
  companyName: string;
  homeHref: string;
  siteReviews?: CatalogPayload["siteReviews"];
  builder?: WebsiteBuilderPageConfig | null;
};

export function AboutPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  siteReviews = [],
  builder,
}: AboutPageProps) {
  const hasBuilder = Boolean(builder);
  const sections = builder?.sections ?? [];
  const mediaLibrary = builder?.mediaLibrary ?? [];
  const heroSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-about-hero",
    type: "hero",
    layouts: ["split", "page-hero"],
  });
  const teamSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-founders",
    type: "team",
    layouts: ["grid", "list"],
  });
  const aboutSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-fast-facts",
    type: "about",
    layouts: ["split", "stack"],
  });
  const testimonialsSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-testimonials",
    type: "testimonials",
    layouts: ["grid", "carousel"],
  });
  const promoSection = resolveBuilderSectionBySignature(sections, {
    ids: "ciseco-promo",
    type: "promo",
    layouts: ["banner", "split"],
  });
  const showHero = heroSection ? heroSection.visible !== false : !hasBuilder;
  const showTeam = teamSection ? teamSection.visible !== false : !hasBuilder;
  const showAbout = aboutSection ? aboutSection.visible !== false : !hasBuilder;
  const showTestimonials = testimonialsSection
    ? testimonialsSection.visible !== false
    : !hasBuilder;
  const showPromo = promoSection ? promoSection.visible !== false : !hasBuilder;
  const showDividerBeforeFacts = showHero || showTeam;
  const showDividerBeforeTestimonials = showHero || showTeam || showAbout;
  const showDividerBeforePromo =
    showHero || showTeam || showAbout || showTestimonials;

  const heroImages = heroSection
    ? heroSection.items
        .map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          if (!asset?.src) return null;
          return {
            src: asset.src,
            alt: asset.alt || item.title || `About gallery ${index + 1}`,
          };
        })
        .filter((image): image is { src: string; alt: string } => Boolean(image))
    : ABOUT_HERO_IMAGES.map((src, index) => ({
        src,
        alt: `About gallery ${index + 1}`,
      }));

  const founders = teamSection
    ? teamSection.items.length > 0
      ? teamSection.items.map((item, index) => {
          const asset = resolveBuilderMedia(item.mediaId, mediaLibrary);
          const defaultFounder = ABOUT_FOUNDERS[index];
          const image =
            asset?.src
              ? { src: asset.src, alt: asset.alt || item.title || "Founder" }
              : defaultFounder
                ? { src: defaultFounder.image, alt: defaultFounder.name }
                : {
                    src: WEBSITE_MEDIA_PLACEHOLDERS.team[
                      index % WEBSITE_MEDIA_PLACEHOLDERS.team.length
                    ],
                    alt: item.title || "Founder",
                  };
          const role = item.tag ?? "";
          const description = item.description ?? "";
          const resolvedRole = role || description;
          const resolvedDescription = role ? description : null;
          return {
            id: item.id,
            name: item.title ?? "Founder",
            role: resolvedRole,
            description: resolvedDescription,
            image,
          };
        })
      : []
    : ABOUT_FOUNDERS.map((founder) => ({
        id: founder.id,
        name: founder.name,
        role: founder.role,
        description: null,
        image: { src: founder.image, alt: founder.name },
      }));

  const facts = aboutSection
    ? aboutSection.items.length > 0
      ? aboutSection.items.map((item, index) => ({
          id: item.id ?? `fact-${index + 1}`,
          value: item.title ?? "0",
          description: item.description ?? "",
        }))
      : []
    : ABOUT_FAST_FACTS.map((fact) => ({
        id: fact.id,
        value: fact.value,
        description: fact.description,
      }));

  const testimonialItems = testimonialsSection?.items ?? [];
  const showTestimonialPhotos = resolveSectionCustomerPhotosVisibility(
    testimonialsSection,
  );
  const testimonials = siteReviews.map((review, index) => {
    const asset = resolveBuilderMedia(testimonialItems[index]?.mediaId, mediaLibrary);
    return {
      id: review.id,
      quote: review.body,
      name: review.authorName,
      role: review.authorRole ?? review.title ?? null,
      rating: review.rating,
      avatar: asset?.src ?? review.avatarUrl ?? null,
    };
  });

  const promoImage = resolveBuilderMedia(promoSection?.mediaId, mediaLibrary);
  const promoTitleRaw = promoSection?.title ?? ABOUT_PROMO_COPY.title;
  const promoTitle =
    promoTitleRaw === ABOUT_PROMO_COPY.title
      ? promoTitleRaw.replaceAll("Ciseco", companyName)
      : promoTitleRaw;
  const promoDescriptionRaw =
    promoSection?.description ?? promoSection?.subtitle ?? ABOUT_PROMO_COPY.description;
  const promoDescription =
    promoDescriptionRaw === ABOUT_PROMO_COPY.description
      ? promoDescriptionRaw.replaceAll("Ciseco", companyName)
      : promoDescriptionRaw;
  const promoButtons =
    promoSection?.buttons?.length
      ? promoSection.buttons.map((button) => ({
          label: button.label ?? "CTA",
          href: button.href ?? "#",
        }))
      : [
          { label: ABOUT_PROMO_COPY.primaryCta, href: "#" },
          { label: ABOUT_PROMO_COPY.secondaryCta, href: "#" },
        ];
  const consumedIds = new Set(
    [heroSection, teamSection, aboutSection, testimonialsSection, promoSection]
      .filter((section): section is WebsiteBuilderSection => Boolean(section))
      .map((section) => section.id),
  );
  const extraSections = sections.filter(
    (section) =>
      section.visible !== false && !consumedIds.has(section.id),
  );

  return (
    <PageShell inlineStyles={inlineStyles}>
      <Navbar theme={theme} companyName={companyName} homeHref={homeHref} />
      <main>
        {showHero ? (
          <AboutHero
            theme={theme}
            title={heroSection?.title ?? ABOUT_HERO_COPY.title}
            description={
              heroSection?.description ??
              heroSection?.subtitle ??
              ABOUT_HERO_COPY.description
            }
            images={heroImages}
            sectionId={heroSection?.id}
          />
        ) : null}
        {showTeam ? (
          <FounderGrid
            theme={theme}
            title={
              teamSection?.eyebrow ??
              teamSection?.title ??
              ABOUT_FOUNDERS_COPY.title
            }
            description={
              teamSection?.description ??
              teamSection?.subtitle ??
              ABOUT_FOUNDERS_COPY.description
            }
            founders={founders}
            sectionId={teamSection?.id}
          />
        ) : null}
        {showAbout ? (
          <>
            {showDividerBeforeFacts ? <SectionDivider theme={theme} /> : null}
            <FastFacts
              theme={theme}
              title={
                aboutSection?.eyebrow ??
                aboutSection?.title ??
                ABOUT_FAST_FACTS_COPY.title
              }
              description={
                aboutSection?.description ??
                aboutSection?.subtitle ??
                ABOUT_FAST_FACTS_COPY.description
              }
              facts={facts}
              sectionId={aboutSection?.id}
            />
          </>
        ) : null}
        {showTestimonials ? (
          <>
            {showDividerBeforeTestimonials ? (
              <SectionDivider theme={theme} />
            ) : null}
            <TestimonialsOrbit
              theme={theme}
              title={testimonialsSection?.title ?? ABOUT_TESTIMONIALS_COPY.title}
              subtitle={
                testimonialsSection?.subtitle ??
                testimonialsSection?.description ??
                ABOUT_TESTIMONIALS_COPY.subtitle
              }
              testimonials={testimonials}
              showCustomerPhotos={showTestimonialPhotos}
              sectionId={testimonialsSection?.id}
            />
          </>
        ) : null}
        {showPromo ? (
          <>
            {showDividerBeforePromo ? <SectionDivider theme={theme} /> : null}
            <PromoBlock
              theme={theme}
              companyName={companyName}
              homeHref={homeHref}
              title={promoTitle}
              description={promoDescription}
              buttons={promoButtons}
              image={
                promoImage?.src
                  ? { src: promoImage.src, alt: promoImage.alt || "Promo" }
                  : { src: ABOUT_PROMO_ILLUSTRATION, alt: "Promo" }
              }
              sectionId={promoSection?.id}
            />
          </>
        ) : null}
        {extraSections.length ? (
          <ExtraSections
            theme={theme}
            sections={extraSections}
            mediaLibrary={mediaLibrary}
          />
        ) : null}
      </main>
      <Footer theme={theme} companyName={companyName} homeHref={homeHref} />
    </PageShell>
  );
}

function SectionDivider({ theme }: { theme: ThemeTokens }) {
  return (
    <div className={clsx("mx-auto px-6 sm:px-8", theme.containerClass)}>
      <div className="border-t border-black/5" />
    </div>
  );
}
