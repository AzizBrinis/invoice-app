"use client";

import clsx from "clsx";
import Image from "next/image";
import type { CSSProperties, ReactElement } from "react";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type { CatalogPayload } from "@/server/website";
import { LeadCaptureForm } from "@/components/website/lead-form";
import { Button } from "@/components/ui/button";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type {
  WebsiteBuilderSection,
  WebsiteBuilderMediaAsset,
  WebsiteBuilderConfig,
  WebsiteBuilderItem,
  WebsiteBuilderButton,
} from "@/lib/website/builder";

type TemplateProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
};

type SectionContext = {
  accent: string;
  buttonShape: string;
  corner: string;
  containerClass: string;
  spacingClass: string;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  website: CatalogPayload["website"];
  products: CatalogPayload["products"];
  mode: "public" | "preview";
  path?: string | null;
};

const spacingMap: Record<NonNullable<WebsiteBuilderConfig["theme"]>["sectionSpacing"], string> = {
  compact: "py-12",
  comfortable: "py-16",
  spacious: "py-24",
};

const containerMap = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

const buttonShapeMap = {
  sharp: "rounded-md",
  rounded: "rounded-2xl",
  pill: "rounded-full",
};

const cornerMap = {
  soft: "rounded-2xl",
  rounded: "rounded-3xl",
  extra: "rounded-[32px]",
};


const friendlySectionLabels: Partial<Record<WebsiteBuilderSection["type"], string>> = {
  hero: "Accueil",
  categories: "Catégories",
  products: "Produits",
  promo: "Offres",
  newsletter: "Newsletter",
  content: "Contenu",
  services: "Services",
  about: "Studio",
  contact: "Contact",
  testimonials: "Avis",
  team: "Équipe",
  gallery: "Portfolio",
  pricing: "Tarifs",
  faq: "FAQ",
  logos: "Références",
};

function formatPrice(
  amount: number,
  currencyCode: string,
  enabled: boolean,
) {
  if (!enabled) {
    return "Sur devis";
  }
  return formatCurrency(fromCents(amount, currencyCode), currencyCode);
}

function resolveMedia(
  assetId: string | null | undefined,
  mediaLibrary: WebsiteBuilderMediaAsset[],
) {
  if (!assetId) return null;
  return mediaLibrary.find((asset) => asset.id === assetId) ?? null;
}

function SectionWrapper({
  section,
  context,
  children,
}: {
  section: WebsiteBuilderSection;
  context: SectionContext;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`section-${section.id}`}
      className={clsx(
        context.spacingClass,
        "scroll-mt-24 border-b border-black/5 last:border-b-0 dark:border-white/5",
      )}
      data-builder-section={section.id}
    >
      <div className={clsx("mx-auto px-6 sm:px-8", context.containerClass)}>
        {children}
      </div>
    </section>
  );
}

function resolveButtonClasses(style: WebsiteBuilderButton["style"] | undefined) {
  switch (style) {
    case "primary":
      return "bg-[var(--site-accent)] text-white shadow-lg shadow-[var(--site-accent)]/30 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40";
    case "secondary":
      return "border border-[var(--site-accent)]/40 text-[var(--site-accent)] hover:bg-[var(--site-accent)]/10";
    default:
      return "border border-black/10 text-zinc-900 hover:bg-black/5 dark:border-white/10 dark:text-white dark:hover:bg-white/10";
  }
}

function HeroSection({
  section,
  context,
}: {
  section: WebsiteBuilderSection;
  context: SectionContext;
}) {
  const media = resolveMedia(section.mediaId, context.mediaLibrary);
  const layout = section.layout ?? "split";
  const heroImageSrc = media?.src ?? WEBSITE_MEDIA_PLACEHOLDERS.hero;
  const heroImageAlt = media?.alt ?? section.title ?? "Illustration héro";
  const heroImageUnoptimized = Boolean(media?.src?.startsWith("data:"));
  const buttons =
    section.buttons && section.buttons.length > 0
      ? section.buttons
      : [
          {
            id: "cta-primary",
            label: context.website.heroPrimaryCtaLabel ?? DEFAULT_PRIMARY_CTA_LABEL,
            href: "#contact",
            style: "primary" as const,
          },
        ];
  return (
    <section
      id="hero"
      data-builder-section={section.id}
      className="relative isolate overflow-hidden border-b border-black/5 bg-gradient-to-b from-white via-white to-white/70 px-6 py-24 transition-colors dark:border-white/5 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950/80 sm:px-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background: `radial-gradient(circle at top, ${context.accent}22, transparent 60%)`,
        }}
      />
      <div
        className={clsx(
          "relative mx-auto grid gap-10",
          context.containerClass,
          layout === "center"
            ? "text-center"
            : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]",
        )}
      >
        <div className="space-y-6">
          {section.eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              {section.eyebrow}
            </p>
          ) : null}
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 dark:text-white sm:text-5xl lg:text-6xl">
              {section.title ?? context.website.heroTitle}
            </h1>
            <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
              {section.subtitle ?? context.website.heroSubtitle}
            </p>
          </div>
          <div className={clsx("flex flex-wrap gap-3", layout === "center" ? "justify-center" : "")}>
            {buttons.map((button) => (
              <Button
                key={button.id}
                asChild
                className={clsx(
                  context.buttonShape,
                  resolveButtonClasses(button.style),
                )}
              >
                <a href={button.href ?? "#contact"}>{button.label}</a>
              </Button>
            ))}
          </div>
        </div>
        {layout !== "center" ? (
          <div
            className={clsx(
              "rounded-[32px] border border-black/5 bg-white/80 p-6 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-zinc-900/70",
              context.corner,
            )}
          >
            <figure className="relative overflow-hidden rounded-3xl border border-black/5 dark:border-white/10">
              <Image
                src={heroImageSrc}
                alt={heroImageAlt}
                width={800}
                height={600}
                className="h-full w-full object-cover"
                unoptimized={heroImageUnoptimized}
                priority
              />
            </figure>
            <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white">
                {context.website.contact.companyName}
              </p>
              <p>
                {context.website.contact.address ??
                  "Ajoutez une phrase inspirante ou votre baseline."}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ServicesSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const fallbackItems = context.products.featured.slice(0, 4).map<WebsiteBuilderItem>((product) => ({
    id: product.id,
    title: product.name,
    description: product.description,
    tag: product.category ?? "Service",
    price: formatPrice(
      product.priceTTCCents,
      context.website.currencyCode,
      context.website.showPrices,
    ),
    stats: [],
  }));
  const items =
    section.items && section.items.length > 0 ? section.items : fallbackItems;

  return (
    <SectionWrapper section={section} context={context}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            {section.eyebrow ?? "Expertises"}
          </p>
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
            {section.title ?? "Services & offres"}
          </h2>
          {section.subtitle ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{section.subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <article
            key={item.id}
            className={clsx(
              "flex h-full flex-col justify-between border border-black/5 bg-white/90 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-[var(--site-accent)] hover:shadow-xl dark:border-white/10 dark:bg-zinc-900",
              context.corner,
            )}
          >
            <div className="space-y-3">
              {item.tag ? (
                <p className="text-xs uppercase tracking-widest text-[var(--site-accent)]">
                  {item.tag}
                </p>
              ) : null}
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">
                {item.title}
              </h3>
              {item.description ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
              ) : null}
            </div>
            <div className="mt-6 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-300">
              <span>{item.price ?? item.href ?? "Pack complet"}</span>
              {item.linkLabel ? (
                <a href={item.href ?? "#contact"} className="text-[var(--site-accent)] hover:underline">
                  {item.linkLabel}
                </a>
              ) : null}
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/20 p-6 text-sm text-zinc-500 dark:border-white/20 dark:text-zinc-300">
            Ajoutez des services depuis le module de personnalisation.
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function AboutSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const stats = section.items ?? [];
  const media = resolveMedia(section.mediaId, context.mediaLibrary);
  const aboutImageSrc = media?.src ?? WEBSITE_MEDIA_PLACEHOLDERS.about;
  const aboutImageAlt = media?.alt ?? section.title ?? "À propos";
  const aboutImageUnoptimized = Boolean(media?.src?.startsWith("data:"));
  return (
    <SectionWrapper section={section} context={context}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            {section.eyebrow ?? "Studio"}
          </p>
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
            {section.title ?? "À propos du studio"}
          </h2>
          <p className="text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
            {section.description ??
              "Racontez votre manifeste, vos valeurs et la manière dont vous collaborez."}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((item) => (
              <article
                key={item.id}
                className={clsx(
                  "rounded-3xl border border-black/5 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900",
                )}
              >
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                {item.description ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
                ) : null}
              </article>
            ))}
            {stats.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-black/10 p-5 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-300">
                Ajoutez des chiffres ou labels clés.
              </p>
            ) : null}
          </div>
        </div>
        <div
          className={clsx(
            "flex items-center justify-center rounded-3xl border border-black/5 bg-white/70 p-4 dark:border-white/10 dark:bg-zinc-900/60",
            context.corner,
          )}
        >
          <Image
            src={aboutImageSrc}
            alt={aboutImageAlt}
            width={720}
            height={900}
            className="h-full w-full rounded-[28px] object-cover"
            unoptimized={aboutImageUnoptimized}
          />
        </div>
      </div>
    </SectionWrapper>
  );
}

function TestimonialsSection({
  section,
  context,
}: {
  section: WebsiteBuilderSection;
  context: SectionContext;
}) {
  const items = section.items ?? [];
  return (
    <SectionWrapper section={section} context={context}>
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          {section.eyebrow ?? "Témoignages"}
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {section.title ?? "Ils nous font confiance"}
        </h2>
        {section.subtitle ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{section.subtitle}</p>
        ) : null}
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-3xl border border-black/5 bg-white/90 p-6 shadow-md dark:border-white/10 dark:bg-zinc-900"
          >
            <p className="text-base leading-relaxed text-zinc-700 dark:text-zinc-200">
              “{item.description ?? item.title}”
            </p>
            <p className="mt-4 text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
            {item.tag ? (
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                {item.tag}
              </p>
            ) : null}
          </article>
        ))}
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/10 p-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-300">
            Ajoutez des témoignages pour renforcer la confiance.
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function TeamSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const items = section.items ?? [];
  return (
    <SectionWrapper section={section} context={context}>
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          {section.eyebrow ?? "Équipe"}
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {section.title ?? "Les personnes derrière le studio"}
        </h2>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((member, index) => {
          const media = resolveMedia(member.mediaId, context.mediaLibrary);
          const portraitPlaceholder =
            WEBSITE_MEDIA_PLACEHOLDERS.team[index % WEBSITE_MEDIA_PLACEHOLDERS.team.length];
          const portraitSrc = media?.src ?? portraitPlaceholder;
          const portraitAlt = media?.alt ?? member.title ?? "Portrait équipe";
          const portraitUnoptimized = Boolean(media?.src?.startsWith("data:"));
          return (
            <article
              key={member.id}
              className="rounded-3xl border border-black/5 bg-white/90 p-5 dark:border-white/10 dark:bg-zinc-900"
            >
              <Image
                src={portraitSrc}
                alt={portraitAlt}
                width={400}
                height={480}
                className="h-48 w-full rounded-2xl object-cover"
                unoptimized={portraitUnoptimized}
              />
              <div className="mt-4">
                <p className="text-lg font-semibold text-zinc-900 dark:text-white">{member.title}</p>
                {member.tag ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{member.tag}</p>
                ) : null}
                {member.description ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{member.description}</p>
                ) : null}
              </div>
            </article>
          );
        })}
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/10 p-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-300">
            Ajoutez des portraits pour humaniser votre agence.
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function GallerySection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const fallbackItems = context.products.all.slice(0, 6).map<WebsiteBuilderItem>((product) => ({
    id: product.id,
    title: product.name,
    description: product.description,
    mediaId: null,
    stats: [],
  }));
  const items =
    section.items?.length ? section.items : fallbackItems;
  return (
    <SectionWrapper section={section} context={context}>
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          {section.eyebrow ?? "Portfolio"}
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {section.title ?? "Réalisations sélectionnées"}
        </h2>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {items.map((item, index) => {
          const media = resolveMedia(item.mediaId, context.mediaLibrary);
          const galleryPlaceholder =
            WEBSITE_MEDIA_PLACEHOLDERS.gallery[
              index % WEBSITE_MEDIA_PLACEHOLDERS.gallery.length
            ];
          const galleryImageSrc = media?.src ?? galleryPlaceholder;
          const galleryAlt = media?.alt ?? item.title ?? "Projet";
          const galleryUnoptimized = Boolean(media?.src?.startsWith("data:"));
          return (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-3xl border border-black/5 shadow-lg dark:border-white/10"
            >
              <Image
                src={galleryImageSrc}
                alt={galleryAlt}
                width={960}
                height={640}
                className="h-64 w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                unoptimized={galleryUnoptimized}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-70" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                {item.description ? (
                  <p className="text-sm text-white/80">{item.description}</p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </SectionWrapper>
  );
}

function PricingSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const items = section.items ?? [];
  return (
    <SectionWrapper section={section} context={context}>
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          {section.eyebrow ?? "Tarifs"}
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {section.title ?? "Plans adaptés à vos enjeux"}
        </h2>
        {section.subtitle ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{section.subtitle}</p>
        ) : null}
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((plan) => (
          <article
            key={plan.id}
            className={clsx(
              "flex h-full flex-col rounded-3xl border border-black/5 bg-white/90 p-6 text-left shadow-md dark:border-white/10 dark:bg-zinc-900",
            )}
          >
            <p className="text-sm uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {plan.tag ?? "Plan"}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-white">
              {plan.title}
            </h3>
            <p className="mt-2 text-3xl font-semibold text-zinc-900 dark:text-white">
              {plan.price ?? "Sur devis"}
            </p>
            {plan.description ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{plan.description}</p>
            ) : null}
            {plan.stats && plan.stats.length > 0 ? (
              <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                {plan.stats.map((feature) => (
                  <li key={feature.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--site-accent)]" />
                    {feature.label} — {feature.value}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
        {items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/10 p-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-300">
            Ajoutez vos offres tarifaires (one-shot, récurrentes, packs...).
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function FAQSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const items = section.items ?? [];
  return (
    <SectionWrapper section={section} context={context}>
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          {section.eyebrow ?? "FAQ"}
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {section.title ?? "Questions fréquentes"}
        </h2>
      </div>
      <div className="mt-8 space-y-4">
        {items.map((item) => (
          <details
            key={item.id}
            className="rounded-2xl border border-black/5 bg-white/80 p-4 text-left dark:border-white/10 dark:bg-zinc-900/70"
          >
            <summary className="cursor-pointer text-lg font-medium text-zinc-900 dark:text-white">
              {item.title}
            </summary>
            {item.description ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
            ) : null}
          </details>
        ))}
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-300">
            Ajoutez vos questions fréquentes.
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function LogosSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  const items = section.items ?? [];
  return (
    <SectionWrapper section={section} context={context}>
      <div className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          {section.eyebrow ?? "Partenaires"}
        </p>
        <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {section.title ?? "Ils travaillent avec nous"}
        </h2>
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        {items.map((item, index) => {
          const media = resolveMedia(item.mediaId, context.mediaLibrary);
          const logoPlaceholder =
            WEBSITE_MEDIA_PLACEHOLDERS.logos[index % WEBSITE_MEDIA_PLACEHOLDERS.logos.length];
          const logoSrc = media?.src ?? logoPlaceholder;
          const logoAlt = media?.alt ?? item.title ?? "Logo";
          const logoUnoptimized = Boolean(media?.src?.startsWith("data:"));
          return (
            <div
              key={item.id}
              className="flex h-32 items-center justify-center rounded-2xl border border-black/5 bg-white/80 p-4 dark:border-white/10 dark:bg-zinc-900"
            >
              <Image
                src={logoSrc}
                alt={logoAlt}
                width={220}
                height={80}
                className="max-h-16 object-contain"
                unoptimized={logoUnoptimized}
              />
            </div>
          );
        })}
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-300">
            Ajoutez des logos pour rassurer vos prospects.
          </div>
        ) : null}
      </div>
    </SectionWrapper>
  );
}

function ContactSection({ section, context }: { section: WebsiteBuilderSection; context: SectionContext }) {
  return (
    <SectionWrapper section={section} context={context}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            {section.eyebrow ?? "Contact"}
          </p>
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-white">
            {section.title ?? "Discutons de votre projet"}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {section.subtitle ??
              context.website.contactBlurb ??
              "Expliquez votre contexte (produit, refonte, renfort d’équipe)."}
          </p>
          {section.buttons?.length ? (
            <div className="flex flex-wrap gap-3">
              {section.buttons.map((button) => (
                <Button
                  key={button.id}
                  asChild
                  className={clsx(
                    context.buttonShape,
                    resolveButtonClasses(button.style),
                  )}
                >
                  <a href={button.href ?? "#contact"}>{button.label}</a>
                </Button>
              ))}
            </div>
          ) : null}
          <dl className="space-y-3 text-sm">
            {context.website.contact.email ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                  Email
                </dt>
                <dd className="text-base text-zinc-900 dark:text-white">
                  <a href={`mailto:${context.website.contact.email}`} className="hover:underline">
                    {context.website.contact.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {context.website.contact.phone ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                  Téléphone
                </dt>
                <dd className="text-base text-zinc-900 dark:text-white">
                  <a href={`tel:${context.website.contact.phone}`} className="hover:underline">
                    {context.website.contact.phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {context.website.contact.address ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
                  Adresse
                </dt>
                <dd className="text-base text-zinc-900 dark:text-white">
                  {context.website.contact.address}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="rounded-3xl border border-black/5 bg-white/90 p-6 shadow-xl dark:border-white/10 dark:bg-zinc-900">
          <LeadCaptureForm
            slug={context.website.slug}
            mode={context.mode}
            thanksMessage={context.website.leadThanksMessage}
            spamProtectionEnabled={context.website.spamProtectionEnabled}
            path={context.path}
            className="space-y-4"
          />
        </div>
      </div>
    </SectionWrapper>
  );
}

const SECTION_COMPONENTS: Partial<
  Record<WebsiteBuilderSection["type"], (props: { section: WebsiteBuilderSection; context: SectionContext }) => ReactElement | null>
> = {
  hero: HeroSection,
  services: ServicesSection,
  about: AboutSection,
  contact: ContactSection,
  testimonials: TestimonialsSection,
  team: TeamSection,
  gallery: GallerySection,
  pricing: PricingSection,
  faq: FAQSection,
  logos: LogosSection,
};

export function DevAgencyTemplate({
  data,
  mode,
  path,
}: TemplateProps) {
  const builder = data.website.builder;
  const accent = builder.theme?.accent ?? data.website.accentColor ?? "#2563eb";
  const sections = builder.sections.filter((section) => section.visible !== false);
  const navItems = sections
    .filter((section) => section.type !== "hero")
    .slice(0, 5)
    .map((section) => ({
      id: `section-${section.id}`,
      label: section.title ?? friendlySectionLabels[section.type] ?? "Section",
    }));

  const accentStyles = {
    "--site-accent": accent,
  } as CSSProperties;

  const context: SectionContext = {
    accent,
    buttonShape: buttonShapeMap[builder.theme?.buttonShape ?? "rounded"],
    corner: cornerMap[builder.theme?.cornerStyle ?? "rounded"],
    containerClass: containerMap[builder.theme?.containerWidth ?? "default"],
    spacingClass: spacingMap[builder.theme?.sectionSpacing ?? "comfortable"],
    mediaLibrary: builder.mediaLibrary ?? [],
    website: data.website,
    products: data.products,
    mode,
    path,
  };

  return (
    <div
      className="min-h-screen bg-white text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-50"
      style={accentStyles}
    >
      {mode === "preview" ? (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Mode prévisualisation — aucune donnée n’est persistée.
        </div>
      ) : null}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/80 px-6 py-4 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
        <div className={clsx("mx-auto flex items-center justify-between gap-4", context.containerClass)}>
          <a href="#hero" className="flex items-center gap-3 text-sm font-semibold tracking-widest text-zinc-900 dark:text-zinc-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-[var(--site-accent)]/10 text-xs uppercase text-[var(--site-accent)] dark:border-white/10">
              {data.website.contact.companyName.slice(0, 2)}
            </div>
            <span>{data.website.contact.companyName}</span>
          </a>
          <nav className="hidden items-center gap-6 text-sm text-zinc-500 dark:text-zinc-300 md:flex">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="transition hover:text-zinc-900 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Button
            asChild
            className={clsx(
              context.buttonShape,
              "bg-[var(--site-accent)] px-4 text-white shadow-lg shadow-[var(--site-accent)]/30 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/50",
            )}
          >
            <a href="#contact">Parler d’un projet</a>
          </Button>
        </div>
      </header>
      <main>
        {sections.map((section) => {
          const Component = SECTION_COMPONENTS[section.type];
          if (!Component) return null;
          return <Component key={section.id} section={section} context={context} />;
        })}
      </main>
      <footer className="border-t border-black/5 bg-white/90 px-6 py-10 text-sm dark:border-white/10 dark:bg-zinc-950/60">
        <div className={clsx("mx-auto flex flex-col gap-6 text-center sm:flex-row sm:items-center sm:justify-between", context.containerClass)}>
          <div>
            <p className="text-base font-semibold text-zinc-900 dark:text-white">
              {data.website.contact.companyName}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Studio web premium — Next.js, produits SaaS & expériences B2B.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            {navItems.map((item) => (
              <a key={item.id} href={`#${item.id}`}>
                {item.label}
              </a>
            ))}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            © {new Date().getFullYear()} — Tous droits réservés.
          </p>
        </div>
      </footer>
    </div>
  );
}
