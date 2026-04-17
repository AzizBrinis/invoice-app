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
import { useCisecoI18n } from "../i18n";
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
  productCount?: number;
  categoryCount?: number;
  blogPostCount?: number;
};

function normalizeAboutText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim().toLocaleLowerCase() ?? "";
}

function matchesAboutCopy(
  value: string | null | undefined,
  candidates: readonly string[],
) {
  const normalized = normalizeAboutText(value);
  if (!normalized) {
    return false;
  }
  return candidates.some(
    (candidate) => normalizeAboutText(candidate) === normalized,
  );
}

function isDefaultAboutTeamSection(section?: WebsiteBuilderSection | null) {
  if (!section) {
    return true;
  }

  if (section.items.length !== ABOUT_FOUNDERS.length) {
    return false;
  }

  return section.items.every((item, index) => {
    const expectedFounder = ABOUT_FOUNDERS[index];
    return (
      normalizeAboutText(item.title) === normalizeAboutText(expectedFounder?.name) &&
      normalizeAboutText(item.tag) === normalizeAboutText(expectedFounder?.role)
    );
  });
}

function isDefaultAboutFactsSection(section?: WebsiteBuilderSection | null) {
  if (!section) {
    return true;
  }

  if (section.items.length !== ABOUT_FAST_FACTS.length) {
    return false;
  }

  return section.items.every((item, index) => {
    const expectedFact = ABOUT_FAST_FACTS[index];
    return (
      normalizeAboutText(item.title) === normalizeAboutText(expectedFact?.value) &&
      normalizeAboutText(item.description) ===
        normalizeAboutText(expectedFact?.description)
    );
  });
}

export function AboutPage({
  theme,
  inlineStyles,
  companyName,
  homeHref,
  siteReviews = [],
  builder,
  productCount = 0,
  categoryCount = 0,
  blogPostCount = 0,
}: AboutPageProps) {
  const { locale } = useCisecoI18n();
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
  const showTeam =
    teamSection != null &&
    teamSection.visible !== false &&
    !isDefaultAboutTeamSection(teamSection);
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

  const numberFormatter = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US");
  const resolvedProductCount = Math.max(0, productCount);
  const resolvedCategoryCount = Math.max(0, categoryCount);
  const secondaryCount = blogPostCount > 0 ? blogPostCount : siteReviews.length;
  const usesPublishedArticles = blogPostCount > 0;
  const useLiveFacts = isDefaultAboutFactsSection(aboutSection);
  const facts = useLiveFacts
    ? [
        {
          id: "catalog-products",
          value: numberFormatter.format(resolvedProductCount),
          description:
            locale === "en"
              ? "Products and digital licences currently available in the catalogue."
              : "Produits et licences numériques actuellement disponibles dans le catalogue.",
        },
        {
          id: "catalog-categories",
          value: numberFormatter.format(resolvedCategoryCount),
          description:
            locale === "en"
              ? "Categories available to browse across the shop."
              : "Catégories actuellement disponibles à parcourir dans la boutique.",
        },
        {
          id: usesPublishedArticles ? "published-articles" : "customer-reviews",
          value: numberFormatter.format(Math.max(0, secondaryCount)),
          description: usesPublishedArticles
            ? locale === "en"
              ? "Published buying guides and articles to help customers choose the right product."
              : "Guides d’achat et articles publiés pour aider les clients à choisir le bon produit."
            : locale === "en"
              ? "Published customer reviews currently visible on the site."
              : "Avis clients publiés et actuellement visibles sur le site.",
        },
      ]
    : aboutSection
      ? aboutSection.items.map((item, index) => ({
          id: item.id ?? `fact-${index + 1}`,
          value: item.title ?? "0",
          description: item.description ?? "",
        }))
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

  const defaultHeroTitle =
    locale === "en" ? `About ${companyName}` : `À propos de ${companyName}`;
  const defaultHeroDescription =
    locale === "en"
      ? `${companyName} helps individuals and businesses find official software, digital licences, and practical solutions with clear guidance and responsive support.`
      : `${companyName} aide les particuliers et les professionnels à trouver des logiciels officiels, des licences numériques et des solutions pratiques avec des conseils clairs et un accompagnement réactif.`;
  const heroTitle =
    heroSection?.title && !matchesAboutCopy(heroSection.title, [ABOUT_HERO_COPY.title, "About us", "About Us"])
      ? heroSection.title
      : defaultHeroTitle;
  const heroDescription =
    heroSection?.description &&
    !matchesAboutCopy(heroSection.description, [ABOUT_HERO_COPY.description])
      ? heroSection.description
      : heroSection?.subtitle &&
          !matchesAboutCopy(heroSection.subtitle, [ABOUT_HERO_COPY.description])
        ? heroSection.subtitle
        : defaultHeroDescription;

  const factsTitle =
    aboutSection?.title &&
    !matchesAboutCopy(aboutSection.title, [ABOUT_FAST_FACTS_COPY.title])
      ? aboutSection.title
      : locale === "en"
        ? "Catalogue snapshot"
        : "Aperçu du catalogue";
  const factsDescription =
    aboutSection?.description &&
    !matchesAboutCopy(aboutSection.description, [ABOUT_FAST_FACTS_COPY.description])
      ? aboutSection.description
      : aboutSection?.subtitle &&
          !matchesAboutCopy(aboutSection.subtitle, [ABOUT_FAST_FACTS_COPY.description])
        ? aboutSection.subtitle
        : locale === "en"
          ? "A quick look at what is currently available across the catalogue and customer resources."
          : "Un aperçu rapide de ce qui est actuellement disponible dans le catalogue et les ressources clients.";

  const testimonialsTitle =
    testimonialsSection?.title &&
    !matchesAboutCopy(testimonialsSection.title, [ABOUT_TESTIMONIALS_COPY.title])
      ? testimonialsSection.title
      : locale === "en"
        ? "Customer reviews"
        : "Avis clients";
  const testimonialsSubtitle =
    testimonialsSection?.subtitle &&
    !matchesAboutCopy(testimonialsSection.subtitle, [ABOUT_TESTIMONIALS_COPY.subtitle])
      ? testimonialsSection.subtitle
      : testimonialsSection?.description &&
          !matchesAboutCopy(testimonialsSection.description, [ABOUT_TESTIMONIALS_COPY.subtitle])
        ? testimonialsSection.description
        : locale === "en"
          ? `See what customers say about their experience with ${companyName}.`
          : `Découvrez ce que les clients disent de leur expérience avec ${companyName}.`;

  const promoImage = resolveBuilderMedia(promoSection?.mediaId, mediaLibrary);
  const promoTitle =
    promoSection?.title &&
    !matchesAboutCopy(promoSection.title, [ABOUT_PROMO_COPY.title])
      ? promoSection.title
      : locale === "en"
        ? "Need help choosing the right product?"
        : "Besoin d'aide pour choisir le bon produit ?";
  const promoDescription =
    promoSection?.description &&
    !matchesAboutCopy(promoSection.description, [ABOUT_PROMO_COPY.description])
      ? promoSection.description
      : promoSection?.subtitle &&
          !matchesAboutCopy(promoSection.subtitle, [ABOUT_PROMO_COPY.description])
        ? promoSection.subtitle
        : locale === "en"
          ? "We help you compare options, identify the right licence, and order with confidence."
          : "Nous vous aidons à comparer les options, identifier la bonne licence et commander en toute confiance.";
  const promoButtons =
    promoSection?.buttons?.length &&
    !promoSection.buttons.every((button, index) =>
      matchesAboutCopy(
        button.label,
        index === 0
          ? [ABOUT_PROMO_COPY.primaryCta]
          : [ABOUT_PROMO_COPY.secondaryCta],
      ),
    )
      ? promoSection.buttons.map((button) => ({
          label: button.label ?? "CTA",
          href: button.href ?? "#",
        }))
      : [
          {
            label: locale === "en" ? "Browse collections" : "Voir les collections",
            href: "/collections",
          },
          {
            label: locale === "en" ? "Contact us" : "Nous contacter",
            href: "/contact",
          },
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
            title={heroTitle}
            description={heroDescription}
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
              title={aboutSection?.eyebrow ?? factsTitle}
              description={factsDescription}
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
              title={testimonialsTitle}
              subtitle={testimonialsSubtitle}
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
