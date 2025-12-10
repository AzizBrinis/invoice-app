"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type {
  WebsiteBuilderConfig,
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { CatalogPayload } from "@/server/website";
import { Button } from "@/components/ui/button";

type TemplateProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
};

type ThemeContext = {
  accent: string;
  containerClass: string;
  corner: string;
  buttonShape: string;
};

type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  cta?: string | null;
  href?: string | null;
  image?: string | null;
  badge?: string | null;
};

type CategoryCard = {
  id: string;
  title: string;
  description?: string | null;
  image?: string | null;
  href?: string | null;
  badge?: string | null;
};

type ProductCardData = {
  id: string;
  title: string;
  description?: string | null;
  price?: string | null;
  badge?: string | null;
  rating?: number;
  image?: string | null;
  href?: string | null;
  category?: string | null;
};

type PromoBanner = {
  id: string;
  title: string;
  description?: string | null;
  tag?: string | null;
  href?: string | null;
};

type PageDescriptor =
  | { page: "home" }
  | { page: "category"; categorySlug: string }
  | { page: "product"; productSlug: string }
  | { page: "cart" }
  | { page: "checkout" }
  | { page: "about" }
  | { page: "contact" };

const buttonShapeMap = {
  sharp: "rounded-md",
  rounded: "rounded-xl",
  pill: "rounded-full",
};

const cornerMap = {
  soft: "rounded-2xl",
  rounded: "rounded-3xl",
  extra: "rounded-[32px]",
};

const containerMap = {
  narrow: "max-w-4xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
};

function normalizePath(path?: string | null): string {
  if (!path) return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function resolvePage(path?: string | null): PageDescriptor {
  const normalized = normalizePath(path);
  const segments = normalized.split("/").filter(Boolean);
  const [head, tail] = segments;
  if (head === "categories" && tail) return { page: "category", categorySlug: tail };
  if (head === "produit" && tail) return { page: "product", productSlug: tail };
  if (head === "product" && tail) return { page: "product", productSlug: tail };
  if (head === "cart" || head === "panier") return { page: "cart" };
  if (head === "checkout" || head === "paiement") return { page: "checkout" };
  if (head === "a-propos" || head === "about") return { page: "about" };
  if (head === "contact") return { page: "contact" };
  return { page: "home" };
}

function resolveMedia(
  assetId: string | null | undefined,
  mediaLibrary: WebsiteBuilderMediaAsset[],
  fallback?: string | null,
) {
  if (!assetId) return fallback ?? null;
  const asset = mediaLibrary.find((entry) => entry.id === assetId);
  return asset?.src ?? fallback ?? null;
}

function resolveSection<T extends WebsiteBuilderSection["type"]>(
  sections: WebsiteBuilderSection[],
  type: T,
  altTypes: WebsiteBuilderSection["type"][] = [],
) {
  return (
    sections.find((section) => section.type === type) ??
    sections.find((section) => altTypes.includes(section.type))
  );
}

function buildSlides(options: {
  hero?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  defaultTitle: string;
  defaultSubtitle?: string | null;
  primaryCta?: string | null;
  accent: string;
}): HeroSlide[] {
  const baseSlides: HeroSlide[] =
    options.hero?.items?.length
      ? options.hero.items.map((item) => ({
          id: item.id,
          title: item.title ?? options.defaultTitle,
          subtitle: item.description ?? options.defaultSubtitle ?? "",
          cta: item.linkLabel ?? options.primaryCta ?? DEFAULT_PRIMARY_CTA_LABEL,
          href: item.href ?? "#produits",
          image: resolveMedia(item.mediaId, options.mediaLibrary, WEBSITE_MEDIA_PLACEHOLDERS.hero),
          badge: item.tag ?? options.hero?.eyebrow ?? "Nouvelle collection",
        }))
      : [
          {
            id: "slide-1",
            title: options.hero?.title ?? options.defaultTitle,
            subtitle:
              options.hero?.subtitle ??
              options.defaultSubtitle ??
              "Collection premium à personnaliser rapidement.",
            cta: options.primaryCta ?? DEFAULT_PRIMARY_CTA_LABEL,
            href: "#categories",
            image: resolveMedia(options.hero?.mediaId, options.mediaLibrary, WEBSITE_MEDIA_PLACEHOLDERS.hero),
            badge: options.hero?.eyebrow ?? "Nouveautés",
          },
          {
            id: "slide-2",
            title: "Édition limitée",
            subtitle: "Pièces iconiques, finitions soignées et expédition rapide.",
            cta: "Découvrir",
            href: "#produits",
            image: WEBSITE_MEDIA_PLACEHOLDERS.gallery[1],
            badge: "Luxe",
          },
          {
            id: "slide-3",
            title: "Experiences immersives",
            subtitle: "Guides, lookbooks et accompagnement personnalisé.",
            cta: "Prendre rendez-vous",
            href: "#contact",
            image: WEBSITE_MEDIA_PLACEHOLDERS.gallery[2],
            badge: "Conciergerie",
          },
        ];

  return baseSlides.slice(0, 4);
}

function buildCategoryCards(options: {
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
}): CategoryCard[] {
  const items = options.section?.items?.length ? options.section.items : [];
  if (items.length) {
    return items.map((item, index) => ({
      id: item.id,
      title: item.title ?? `Catégorie ${index + 1}`,
      description: item.description ?? "Ajoutez une courte description.",
      badge: item.tag ?? null,
      href: item.href ?? `/categories/${item.title?.toLowerCase().replace(/\s+/g, "-") ?? "categorie"}`,
      image: resolveMedia(
        item.mediaId,
        options.mediaLibrary,
        WEBSITE_MEDIA_PLACEHOLDERS.categories[index % WEBSITE_MEDIA_PLACEHOLDERS.categories.length],
      ),
    }));
  }
  return [
    {
      id: "cat-1",
      title: "Catégorie 1",
      description: "Univers prêt-à-porter premium.",
      href: "/categories/categorie-1",
      image: WEBSITE_MEDIA_PLACEHOLDERS.categories[0],
      badge: "Nouvelle",
    },
    {
      id: "cat-2",
      title: "Catégorie 2",
      description: "Accessoires & pièces iconiques.",
      href: "/categories/categorie-2",
      image: WEBSITE_MEDIA_PLACEHOLDERS.categories[1],
    },
    {
      id: "cat-3",
      title: "Catégorie 3",
      description: "Maison & art de vivre.",
      href: "/categories/categorie-3",
      image: WEBSITE_MEDIA_PLACEHOLDERS.categories[2],
    },
  ];
}

function buildProductGrid(options: {
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
}): ProductCardData[] {
  const items = options.section?.items?.length ? options.section.items : [];
  if (items.length) {
    return items.map((item, index) => ({
      id: item.id,
      title: item.title ?? `Produit ${index + 1}`,
      description: item.description ?? "Décrivez le produit, sa matière et son usage.",
      price: item.price ?? "159 €",
      badge: item.badge ?? item.tag ?? null,
      rating: 4.7 - index * 0.1,
      category: item.tag ?? "Collection",
      href: item.href ?? `/produit/${item.title?.toLowerCase().replace(/\s+/g, "-") ?? `produit-${index + 1}`}`,
      image: resolveMedia(
        item.mediaId,
        options.mediaLibrary,
        WEBSITE_MEDIA_PLACEHOLDERS.products[index % WEBSITE_MEDIA_PLACEHOLDERS.products.length],
      ),
    }));
  }
  return [
    {
      id: "prod-1",
      title: "Produit 1",
      description: "Texture douce, coupe ajustée, finition premium.",
      price: "149 €",
      rating: 4.8,
      badge: "Nouveau",
      category: "Best-sellers",
      href: "/produit/produit-1",
      image: WEBSITE_MEDIA_PLACEHOLDERS.products[0],
    },
    {
      id: "prod-2",
      title: "Produit 2",
      description: "Edition limitée, matières responsables.",
      price: "189 €",
      rating: 4.9,
      badge: "Edition limitée",
      category: "Atelier",
      href: "/produit/produit-2",
      image: WEBSITE_MEDIA_PLACEHOLDERS.products[1],
    },
    {
      id: "prod-3",
      title: "Produit 3",
      description: "Design minimaliste, silhouette intemporelle.",
      price: "129 €",
      rating: 4.7,
      badge: "Pré-commande",
      category: "Intemporels",
      href: "/produit/produit-3",
      image: WEBSITE_MEDIA_PLACEHOLDERS.products[2],
    },
    {
      id: "prod-4",
      title: "Produit 4",
      description: "Disponible en plusieurs coloris.",
      price: "99 €",
      rating: 4.6,
      badge: null,
      category: "Essentiels",
      href: "/produit/produit-4",
      image: WEBSITE_MEDIA_PLACEHOLDERS.products[0],
    },
  ];
}

function buildPromos(section?: WebsiteBuilderSection | null): PromoBanner[] {
  const items = section?.items ?? [];
  if (items.length) {
    return items.map((item, index) => ({
      id: item.id,
      title: item.title ?? `Offre ${index + 1}`,
      description: item.description ?? "Ajoutez des conditions ou un code promo.",
      tag: item.tag ?? "Offre",
      href: item.href ?? "#checkout",
    }));
  }
  return [
    {
      id: "promo-1",
      title: "Livraison offerte",
      description: "Dès 120 € d’achats — valable en Europe.",
      tag: "Shipping",
      href: "/checkout",
    },
    {
      id: "promo-2",
      title: "Retours gratuits 30 jours",
      description: "Essayez chez vous, renvoyez facilement.",
      tag: "Confiance",
      href: "/contact",
    },
  ];
}

function buildNewsletterCopy(section?: WebsiteBuilderSection | null) {
  return {
    title: section?.title ?? "Newsletter privée",
    subtitle:
      section?.subtitle ??
      "Recevez les lancements, avant-premières et listes d’attente en priorité.",
    cta:
      section?.buttons?.[0]?.label ??
      section?.eyebrow ??
      "S’abonner",
  };
}

function RatingStars({ value }: { value?: number }) {
  if (!value) return null;
  const rounded = Math.min(5, Math.max(0, Math.round(value * 10) / 10));
  return (
    <div className="flex items-center gap-1 text-amber-500" aria-label={`Note ${rounded} sur 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} aria-hidden="true">
          {index + 1 <= Math.floor(rounded) ? "★" : "☆"}
        </span>
      ))}
      <span className="text-xs text-zinc-600 dark:text-zinc-300">({rounded})</span>
    </div>
  );
}

function SearchBar({ placeholder }: { placeholder: string }) {
  return (
    <div className="group relative flex-1">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M15.5 15.5L20 20"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      <input
        type="search"
        placeholder={placeholder}
        className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-[var(--site-accent)] focus:ring-2 focus:ring-[var(--site-accent)]/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </div>
  );
}

function Breadcrumbs({
  items,
  theme,
}: {
  items: { label: string; href?: string }[];
  theme: ThemeContext;
}) {
  return (
    <nav className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400" aria-label="Fil d’Ariane">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-2">
          {item.href && index !== items.length - 1 ? (
            <a
              href={item.href}
              className="underline decoration-dotted underline-offset-4 hover:text-[var(--site-accent)]"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-zinc-700 dark:text-zinc-100">{item.label}</span>
          )}
          {index !== items.length - 1 ? <span aria-hidden="true">/</span> : null}
        </span>
      ))}
    </nav>
  );
}

function Pagination({ theme }: { theme: ThemeContext }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="text-zinc-600 dark:text-zinc-300">Page 1 sur 4</span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className={clsx(theme.buttonShape, "border border-zinc-200 bg-white px-3 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900")}
        >
          Précédent
        </Button>
        <Button className={clsx(theme.buttonShape, "px-3 py-1 text-xs")}>Suivant</Button>
      </div>
    </div>
  );
}

function FilterSidebar({ theme, categories }: { theme: ThemeContext; categories: CategoryCard[] }) {
  return (
    <aside className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Filtrer</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Affinez les produits visibles.</p>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Prix</p>
        <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
          <label className="flex items-center justify-between">
            <span>Min (€)</span>
            <input type="number" defaultValue={49} className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-right dark:border-zinc-800 dark:bg-zinc-950" />
          </label>
          <label className="flex items-center justify-between">
            <span>Max (€)</span>
            <input type="number" defaultValue={320} className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-right dark:border-zinc-800 dark:bg-zinc-950" />
          </label>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Catégories</p>
        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="accent-[var(--site-accent)]" />
              <span>{cat.title}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Attributs</p>
        <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
          {["Nouveautés", "Populaire", "En stock", "Edition limitée"].map((attr) => (
            <label key={attr} className="flex items-center gap-2">
              <input type="checkbox" className="accent-[var(--site-accent)]" defaultChecked={attr === "En stock"} />
              <span>{attr}</span>
            </label>
          ))}
        </div>
      </div>
      <Button className={clsx(theme.buttonShape, "w-full")}>Appliquer</Button>
    </aside>
  );
}

function ProductCard({ product, theme, baseLink }: { product: ProductCardData; theme: ThemeContext; baseLink: (path: string) => string }) {
  return (
    <article className={clsx("group flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900", theme.corner)}>
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div
            role="img"
            aria-label={product.title}
            className="flex h-full w-full items-center justify-center text-sm text-zinc-400"
            style={{
              background: "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.05), transparent 40%), radial-gradient(circle at 80% 0%, rgba(0,0,0,0.04), transparent 30%)",
            }}
          >
            Visuel produit
          </div>
        )}
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--site-accent)] shadow-sm dark:bg-zinc-900/80">
            {product.badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
              {product.category ?? "Collection"}
            </p>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              <a href={baseLink(product.href ?? "#")} className="hover:text-[var(--site-accent)]">
                {product.title}
              </a>
            </h3>
          </div>
          <p className="text-base font-semibold text-zinc-900 dark:text-white">{product.price ?? "Prix sur demande"}</p>
        </div>
        <p className="flex-1 text-sm text-zinc-600 dark:text-zinc-300">{product.description}</p>
        <div className="flex items-center justify-between">
          <RatingStars value={product.rating} />
          <Button className={clsx(theme.buttonShape, "px-4 py-2 text-sm")}>Ajouter au panier</Button>
        </div>
      </div>
    </article>
  );
}

function PromoGrid({ promos, theme, baseLink }: { promos: PromoBanner[]; theme: ThemeContext; baseLink: (path: string) => string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {promos.map((promo) => (
        <div
          key={promo.id}
          className={clsx(
            "relative overflow-hidden rounded-3xl border border-zinc-200 bg-gradient-to-r from-[var(--site-accent)]/10 via-white to-white/80 p-6 shadow-sm dark:border-zinc-800 dark:from-[var(--site-accent)]/20 dark:via-zinc-950 dark:to-black",
            theme.corner,
          )}
        >
          <div className="space-y-2">
            {promo.tag ? (
              <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--site-accent)]">{promo.tag}</p>
            ) : null}
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">{promo.title}</h3>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{promo.description}</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--site-accent)]">
            <a href={baseLink(promo.href ?? "/checkout")}>Voir les détails</a>
            <span aria-hidden="true">→</span>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-[var(--site-accent)]/10 blur-3xl"
          />
        </div>
      ))}
    </div>
  );
}

function NewsletterBlock({
  copy,
  theme,
}: {
  copy: { title: string; subtitle: string; cta: string };
  theme: ThemeContext;
}) {
  return (
    <section
      id="newsletter"
      className="relative overflow-hidden rounded-[32px] border border-zinc-200 bg-gradient-to-r from-[var(--site-accent)]/10 via-white to-white/80 p-8 shadow-sm dark:border-zinc-800 dark:from-[var(--site-accent)]/20 dark:via-zinc-950 dark:to-black"
    >
      <div className="grid gap-6 md:grid-cols-[2fr_3fr] md:items-center">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--site-accent)]">Newsletter</p>
          <h3 className="text-2xl font-semibold text-zinc-900 dark:text-white">{copy.title}</h3>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{copy.subtitle}</p>
        </div>
        <form className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="sr-only" htmlFor="newsletter-email">
            Email
          </label>
          <input
            id="newsletter-email"
            type="email"
            required
            placeholder="email@exemple.com"
            className="w-full flex-1 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-[var(--site-accent)] focus:ring-2 focus:ring-[var(--site-accent)]/30 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
          <Button type="submit" className={clsx(theme.buttonShape, "px-5 py-3 text-sm")}>
            {copy.cta}
          </Button>
        </form>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-[var(--site-accent)]/10 blur-3xl"
      />
    </section>
  );
}

function Footer({
  theme,
  company,
  baseLink,
}: {
  theme: ThemeContext;
  company: CatalogPayload["website"]["contact"];
  baseLink: (path: string) => string;
}) {
  return (
    <footer className="border-t border-zinc-200 bg-white/90 py-10 text-sm dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className={clsx("mx-auto grid gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4", theme.containerClass)}>
        <div className="space-y-3">
          <p className="text-base font-semibold text-zinc-900 dark:text-white">{company.companyName}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Boutique élégante et personnalisable — adaptez textes, images et collections.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Contact</p>
          {company.email ? (
            <a href={`mailto:${company.email}`} className="block hover:text-[var(--site-accent)]">
              {company.email}
            </a>
          ) : null}
          {company.phone ? (
            <a href={`tel:${company.phone}`} className="block hover:text-[var(--site-accent)]">
              {company.phone}
            </a>
          ) : null}
          {company.address ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{company.address}</p> : null}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Politiques</p>
          {["Conditions", "Confidentialité", "Retours & remboursements"].map((entry, index) => (
            <a key={entry} href={baseLink(`/politiques/${index + 1}`)} className="block hover:text-[var(--site-accent)]">
              {entry}
            </a>
          ))}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Réseaux</p>
          <div className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-300">
            {["Instagram", "Pinterest", "LinkedIn"].map((entry) => (
              <a key={entry} href="#" className="underline decoration-dotted underline-offset-4 hover:text-[var(--site-accent)]">
                {entry}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className={clsx("mx-auto mt-8 flex flex-wrap items-center justify-between gap-3 px-6 text-xs text-zinc-500 dark:text-zinc-400", theme.containerClass)}>
        <p>© {new Date().getFullYear()} — {company.companyName}</p>
        <p>Template e-commerce premium, personnalisable sans code.</p>
      </div>
    </footer>
  );
}

function Navbar({
  theme,
  company,
  categories,
  baseLink,
  cartCount,
}: {
  theme: ThemeContext;
  company: CatalogPayload["website"]["contact"];
  categories: CategoryCard[];
  baseLink: (path: string) => string;
  cartCount: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className={clsx("mx-auto flex items-center gap-4 px-6 py-3", theme.containerClass)}>
        <a href={baseLink("/")} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-[var(--site-accent)]/10 text-xs font-semibold uppercase text-[var(--site-accent)] shadow-sm dark:border-zinc-800">
            {company.companyName.slice(0, 2)}
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-white">{company.companyName}</span>
        </a>
        <div className="hidden flex-1 items-center gap-3 lg:flex">
          <SearchBar placeholder="Rechercher un produit" />
          <div className="relative">
            <button
              type="button"
              className={clsx(
                "flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:border-[var(--site-accent)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200",
                theme.buttonShape,
              )}
            >
              Catégories
              <span aria-hidden="true">▾</span>
            </button>
            <div className="absolute right-0 top-12 z-20 hidden w-64 rounded-2xl border border-zinc-200 bg-white p-3 text-sm shadow-xl dark:border-zinc-800 dark:bg-zinc-900 lg:group-hover:block">
              <div className="space-y-2">
                {categories.map((category) => (
                  <a key={category.id} href={baseLink(category.href ?? "#")} className="block rounded-lg px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                    {category.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <a
            href={baseLink("/contact")}
            className="hidden text-sm text-zinc-700 underline decoration-dotted underline-offset-4 hover:text-[var(--site-accent)] dark:text-zinc-200 lg:inline"
          >
            Contact
          </a>
          <a
            href={baseLink("/panier")}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-[var(--site-accent)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Panier"
          >
            🛍️
            <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--site-accent)] text-[10px] font-semibold text-white">
              {cartCount}
            </span>
          </a>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-[var(--site-accent)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 lg:hidden"
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-zinc-200 bg-white px-6 py-4 text-sm shadow-md dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
          <div className="space-y-3">
            <SearchBar placeholder="Rechercher un produit" />
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <a
                  key={category.id}
                  href={baseLink(category.href ?? "#")}
                  className="rounded-full border border-zinc-200 px-3 py-2 text-xs text-zinc-700 hover:border-[var(--site-accent)] dark:border-zinc-800 dark:text-zinc-200"
                >
                  {category.title}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <a href={baseLink("/contact")} className="text-[13px] underline decoration-dotted underline-offset-4">
                Contact
              </a>
              <a href={baseLink("/a-propos")} className="text-[13px] underline decoration-dotted underline-offset-4">
                À propos
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function HeroSlider({
  slides,
  theme,
  baseLink,
}: {
  slides: HeroSlide[];
  theme: ThemeContext;
  baseLink: (path: string) => string;
}) {
  const [active, setActive] = useState(0);
  const current = slides[active] ?? slides[0];
  return (
    <section className="relative overflow-hidden border-b border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-950">
      <div className={clsx("mx-auto grid gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center", theme.containerClass)}>
        <div className="space-y-6">
          {current.badge ? (
            <span className="inline-flex rounded-full bg-[var(--site-accent)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[var(--site-accent)]">
              {current.badge}
            </span>
          ) : null}
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold leading-tight text-zinc-900 dark:text-white sm:text-5xl">
              {current.title}
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-300">{current.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className={clsx(theme.buttonShape, "px-5 py-3 text-sm")}
            >
              <a href={baseLink(current.href ?? "#")}>{current.cta ?? DEFAULT_PRIMARY_CTA_LABEL}</a>
            </Button>
            <a
              href={baseLink("/a-propos")}
              className="text-sm font-semibold text-zinc-800 underline decoration-dotted underline-offset-4 hover:text-[var(--site-accent)] dark:text-zinc-100"
            >
              Découvrir la marque
            </a>
          </div>
          <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
            <span>Livraison rapide</span>
            <span aria-hidden="true">•</span>
            <span>Retours offerts</span>
            <span aria-hidden="true">•</span>
            <span>Personnalisable</span>
          </div>
        </div>
        <div
          className={clsx(
            "relative overflow-hidden rounded-[32px] border border-zinc-200 bg-gradient-to-br from-white via-white to-zinc-50 shadow-2xl dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-950 dark:to-black",
            theme.corner,
          )}
        >
          <div className="aspect-[4/3]">
            {current.image ? (
              <img
                src={current.image}
                alt={current.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[var(--site-accent)]/10 text-sm text-zinc-600 dark:text-zinc-300">
                Image de bannière
              </div>
            )}
          </div>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setActive(index)}
                className={clsx(
                  "h-2 rounded-full bg-white/70 shadow-sm ring-1 ring-black/5 transition dark:bg-zinc-800 dark:ring-white/10",
                  index === active ? "w-6 bg-[var(--site-accent)]" : "w-2",
                )}
                aria-label={`Afficher la slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomePage({
  theme,
  slides,
  categories,
  products,
  promos,
  newsletter,
  baseLink,
}: {
  theme: ThemeContext;
  slides: HeroSlide[];
  categories: CategoryCard[];
  products: ProductCardData[];
  promos: PromoBanner[];
  newsletter: { title: string; subtitle: string; cta: string };
  baseLink: (path: string) => string;
}) {
  return (
    <main className="space-y-10 bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.04),transparent_30%)] px-0 pb-12 pt-2 dark:bg-[radial-gradient(circle_at_20%_0%,rgba(37,99,235,0.08),transparent_30%)]">
      <HeroSlider slides={slides} theme={theme} baseLink={baseLink} />
      <section id="categories" className={clsx("mx-auto space-y-6 px-6", theme.containerClass)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Univers
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Catégories phares</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">Remplacez les visuels, labels et liens.</p>
          </div>
          <a
            href={baseLink("/categories/toutes")}
            className="text-sm font-semibold text-[var(--site-accent)] underline decoration-dotted underline-offset-4"
          >
            Voir toutes les catégories
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <a
              key={category.id}
              href={baseLink(category.href ?? "#")}
              className={clsx(
                "group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900",
                theme.corner,
              )}
            >
              <div className="aspect-[4/3] overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-zinc-50 dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500 dark:text-zinc-300">
                    Image de catégorie
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent opacity-80 transition group-hover:opacity-90" />
              <div className="absolute inset-0 flex items-end p-5 text-white">
                <div className="space-y-1">
                  {category.badge ? (
                    <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]">
                      {category.badge}
                    </span>
                  ) : null}
                  <h3 className="text-xl font-semibold">{category.title}</h3>
                  <p className="text-sm text-white/80">{category.description}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <section id="produits" className={clsx("mx-auto space-y-6 px-6", theme.containerClass)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
              Sélection
            </p>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Produits mis en avant</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">2 colonnes sur mobile, 4 sur desktop.</p>
          </div>
          <div className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-300">
            Trier :
            <select className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-950">
              <option>Popularité</option>
              <option>Prix croissant</option>
              <option>Nouveautés</option>
            </select>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} theme={theme} baseLink={baseLink} />
          ))}
        </div>
      </section>

      <section className={clsx("mx-auto space-y-6 px-6", theme.containerClass)}>
        <PromoGrid promos={promos} theme={theme} baseLink={baseLink} />
      </section>

      <section className={clsx("mx-auto px-6", theme.containerClass)}>
        <NewsletterBlock copy={newsletter} theme={theme} />
      </section>
    </main>
  );
}

function CategoryPage({
  theme,
  categories,
  products,
  baseLink,
}: {
  theme: ThemeContext;
  categories: CategoryCard[];
  products: ProductCardData[];
  baseLink: (path: string) => string;
}) {
  const pageProducts = products.slice(0, 8);
  return (
    <main className={clsx("mx-auto space-y-6 px-6 py-10", theme.containerClass)}>
      <div className="space-y-3">
        <Breadcrumbs
          items={[
            { label: "Accueil", href: baseLink("/") },
            { label: "Catégories", href: baseLink("/categories/toutes") },
            { label: "Catégorie en vedette" },
          ]}
          theme={theme}
        />
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">Catégorie 1 — Sélection</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Ajustez le contenu, les filtres et les cartes produits dans le builder.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <FilterSidebar theme={theme} categories={categories} />
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {pageProducts.length} produits — affichage 1/4 pages
            </p>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              Trier :
              <select className="rounded-full border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-800 dark:bg-zinc-950">
                <option>Nouveautés</option>
                <option>Prix croissant</option>
                <option>Popularité</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageProducts.map((product) => (
              <ProductCard key={product.id} product={product} theme={theme} baseLink={baseLink} />
            ))}
          </div>
          <Pagination theme={theme} />
        </div>
      </div>
    </main>
  );
}

function ProductGallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <img src={current} alt={title} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {images.map((image, index) => (
          <button
            key={image + index.toString()}
            type="button"
            onClick={() => setActive(index)}
            className={clsx(
              "h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition",
              index === active
                ? "border-[var(--site-accent)]"
                : "border-zinc-200 dark:border-zinc-800",
            )}
          >
            <img src={image} alt={`${title} aperçu ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductPage({
  theme,
  product,
  related,
  baseLink,
}: {
  theme: ThemeContext;
  product: ProductCardData;
  related: ProductCardData[];
  baseLink: (path: string) => string;
}) {
  const [quantity, setQuantity] = useState(1);
  const images = [product.image, WEBSITE_MEDIA_PLACEHOLDERS.products[1], WEBSITE_MEDIA_PLACEHOLDERS.products[2]].filter(Boolean) as string[];
  const tabs = [
    { id: "description", label: "Description", content: product.description ?? "Ajoutez une description détaillée, matières, entretien." },
    {
      id: "specs",
      label: "Spécifications",
      content: "Taille, coupe, composition, fabrication — modifiables via le builder.",
    },
    {
      id: "reviews",
      label: "Avis",
      content: "Affichez des témoignages et la note moyenne.",
    },
  ];
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "description");

  return (
    <main className={clsx("mx-auto space-y-10 px-6 py-10", theme.containerClass)}>
      <Breadcrumbs
        items={[
          { label: "Accueil", href: baseLink("/") },
          { label: "Produits", href: baseLink("/categories/toutes") },
          { label: product.title },
        ]}
        theme={theme}
      />
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <ProductGallery images={images} title={product.title} />
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {product.badge ? (
            <span className="inline-flex rounded-full bg-[var(--site-accent)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--site-accent)]">
              {product.badge}
            </span>
          ) : null}
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">{product.title}</h1>
          <div className="flex items-center justify-between">
            <RatingStars value={product.rating ?? 4.8} />
            <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{product.price ?? "219 €"}</p>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Prix HT : {product.price ?? "183 €"} — TVA affichée en option. Stock : {product.badge ? "Disponible" : "Sur commande"}.
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">{product.description}</p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
              Quantité
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </label>
            <Button className={clsx(theme.buttonShape, "px-5 py-3 text-sm")}>Ajouter au panier</Button>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    "rounded-full px-4 py-2 text-xs font-semibold",
                    activeTab === tab.id
                      ? "bg-[var(--site-accent)] text-white"
                      : "border border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-200",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200">
              {tabs.find((tab) => tab.id === activeTab)?.content}
            </div>
          </div>
          <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
            <p>✔️ Livraison express, suivi en temps réel</p>
            <p>✔️ Retours gratuits sous 30 jours</p>
            <p>✔️ Assistance concierge dédiée</p>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Produits similaires</h2>
          <a href={baseLink("/categories/toutes")} className="text-sm text-[var(--site-accent)] underline decoration-dotted underline-offset-4">
            Voir toute la collection
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.id} product={item} theme={theme} baseLink={baseLink} />
          ))}
        </div>
      </section>
    </main>
  );
}

function CartPage({
  theme,
  cartItems,
  baseLink,
}: {
  theme: ThemeContext;
  cartItems: ProductCardData[];
  baseLink: (path: string) => string;
}) {
  const subtotal =  cartItems.reduce((sum, item) => sum + (Number(item.price?.replace(/[^\d]/g, "")) || 120), 0);
  return (
    <main className={clsx("mx-auto space-y-6 px-6 py-10", theme.containerClass)}>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">Panier</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Ajustez les quantités ou supprimez les articles.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {cartItems.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-4 border-b border-zinc-100 pb-4 last:border-none last:pb-0 dark:border-zinc-800">
              <div className="h-16 w-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                <img src={item.image ?? WEBSITE_MEDIA_PLACEHOLDERS.products[0]} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.category ?? "Collection"}</p>
              </div>
              <input
                type="number"
                min={1}
                defaultValue={1}
                className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                aria-label={`Quantité pour ${item.title}`}
              />
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.price ?? "129 €"}</p>
              <button type="button" className="text-xs text-red-500">
                Supprimer
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Récapitulatif</h2>
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            <div className="flex items-center justify-between">
              <span>Sous-total</span>
              <span>{subtotal.toLocaleString("fr-FR")} €</span>
            </div>
            <div className="flex items-center justify-between">
              <span>TVA estimée (20%)</span>
              <span>{Math.round(subtotal * 0.2).toLocaleString("fr-FR")} €</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>{Math.round(subtotal * 1.2).toLocaleString("fr-FR")} €</span>
            </div>
          </div>
          <Button asChild className={clsx(theme.buttonShape, "w-full px-4 py-3 text-sm")}>
            <a href={baseLink("/checkout")}>Passer au paiement</a>
          </Button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Politique de retour 30 jours. Saisie des codes promotionnels à l’étape suivante.
          </p>
        </div>
      </div>
    </main>
  );
}

function CheckoutPage({ theme }: { theme: ThemeContext }) {
  return (
    <main className={clsx("mx-auto space-y-6 px-6 py-10", theme.containerClass)}>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">Paiement sécurisé</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">Formulaire éditable — ajoutez vos moyens de paiement.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Informations client</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-zinc-700 dark:text-zinc-200">
              Nom complet
              <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="Prénom Nom" />
            </label>
            <label className="text-sm text-zinc-700 dark:text-zinc-200">
              Email
              <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="email@exemple.com" />
            </label>
            <label className="text-sm text-zinc-700 dark:text-zinc-200">
              Téléphone
              <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="+33 ..." />
            </label>
            <label className="text-sm text-zinc-700 dark:text-zinc-200">
              Adresse
              <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" placeholder="Adresse complète" />
            </label>
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Expédition</h3>
          <textarea className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" rows={3} placeholder="Instructions, créneau de livraison..." />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Paiement</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {["Carte bancaire", "PayPal", "Paiement à la livraison"].map((method) => (
              <label
                key={method}
                className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-200"
              >
                <input type="radio" name="payment" defaultChecked={method === "Carte bancaire"} />
                <span>{method}</span>
              </label>
            ))}
          </div>
          <Button className={clsx(theme.buttonShape, "w-full px-4 py-3 text-sm")}>Confirmer la commande</Button>
        </div>
        <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Récapitulatif</h2>
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            <div className="flex items-center justify-between">
              <span>Sous-total</span>
              <span>329 €</span>
            </div>
            <div className="flex items-center justify-between">
              <span>TVA estimée</span>
              <span>65 €</span>
            </div>
            <div className="flex items-center justify-between font-semibold">
              <span>Total</span>
              <span>394 €</span>
            </div>
          </div>
          <div className="rounded-2xl border border-dashed border-[var(--site-accent)]/30 bg-[var(--site-accent)]/5 p-4 text-sm text-zinc-700 dark:border-[var(--site-accent)]/40 dark:bg-[var(--site-accent)]/10 dark:text-zinc-200">
            Ajoutez ici vos codes promos ou notes logistiques.
          </div>
        </div>
      </div>
    </main>
  );
}

function AboutPage({
  theme,
  aboutSection,
  baseLink,
}: {
  theme: ThemeContext;
  aboutSection?: WebsiteBuilderSection | null;
  baseLink: (path: string) => string;
}) {
  const highlights = aboutSection?.items ?? [
    { id: "h1", title: "Mission", description: "Partager des collections durables et élégantes." },
    { id: "h2", title: "Vision", description: "Créer des expériences d’achat premium accessibles." },
  ];
  return (
    <main className={clsx("mx-auto grid gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]", theme.containerClass)}>
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">
          {aboutSection?.title ?? "À propos — votre histoire"}
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          {aboutSection?.description ??
            "Décrivez votre ADN de marque, vos engagements, vos ateliers ou votre processus de création. Cette zone est entièrement éditable via le builder."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {highlights.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-white">{item.title}</p>
              {item.description ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-300">{item.description}</p>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button asChild className={clsx(theme.buttonShape, "px-4 py-3 text-sm")}>
            <a href={baseLink("/contact")}>Nous contacter</a>
          </Button>
          <Button variant="secondary" asChild className={clsx(theme.buttonShape, "px-4 py-3 text-sm")}>
            <a href={baseLink("/categories/toutes")}>Voir les collections</a>
          </Button>
        </div>
      </div>
      <div
        className={clsx(
          "relative overflow-hidden rounded-[32px] border border-zinc-200 bg-gradient-to-br from-white via-white to-zinc-50 shadow-xl dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-950 dark:to-black",
          theme.corner,
        )}
      >
        <div className="aspect-[4/3]">
          <div className="flex h-full items-center justify-center bg-[var(--site-accent)]/10 text-sm text-zinc-700 dark:text-zinc-200">
            Image équipe / atelier
          </div>
        </div>
      </div>
    </main>
  );
}

function ContactPage({
  theme,
  contactBlurb,
  company,
}: {
  theme: ThemeContext;
  contactBlurb?: string | null;
  company: CatalogPayload["website"]["contact"];
}) {
  return (
    <main className={clsx("mx-auto grid gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]", theme.containerClass)}>
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white">Contact</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {contactBlurb ?? "Formulaire de contact, carte et coordonnées éditables depuis le builder."}
        </p>
        <form className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-zinc-700 dark:text-zinc-200">
              Nom complet
              <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
            </label>
            <label className="text-sm text-zinc-700 dark:text-zinc-200">
              Email
              <input className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
            </label>
          </div>
          <label className="text-sm text-zinc-700 dark:text-zinc-200">
            Message
            <textarea className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950" rows={4} />
          </label>
          <Button className={clsx(theme.buttonShape, "px-4 py-3 text-sm")}>Envoyer</Button>
        </form>
      </div>
      <div className="space-y-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">Informations</p>
          <dl className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-200">
            {company.email ? (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Email</span>
                <a href={`mailto:${company.email}`} className="underline decoration-dotted underline-offset-4">
                  {company.email}
                </a>
              </div>
            ) : null}
            {company.phone ? (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">Téléphone</span>
                <a href={`tel:${company.phone}`} className="underline decoration-dotted underline-offset-4">
                  {company.phone}
                </a>
              </div>
            ) : null}
            {company.address ? <p>{company.address}</p> : null}
          </dl>
        </div>
        <div className="rounded-3xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
          <p className="font-semibold text-zinc-900 dark:text-white">Carte / boutique</p>
          <p>Zone prévue pour intégrer une carte, une image ou une vidéo de présentation.</p>
        </div>
      </div>
    </main>
  );
}

export function EcommerceTemplate({
  data,
  mode,
  path,
}: TemplateProps) {
  const builder = data.website.builder;
  const accent = builder.theme?.accent ?? data.website.accentColor ?? "#0f172a";
  const theme: ThemeContext = {
    accent,
    containerClass: containerMap[builder.theme?.containerWidth ?? "default"],
    corner: cornerMap[builder.theme?.cornerStyle ?? "rounded"],
    buttonShape: buttonShapeMap[builder.theme?.buttonShape ?? "rounded"],
  };
  const visibleSections = builder.sections.filter((section) => section.visible !== false);
  const heroSection = resolveSection(visibleSections, "hero");
  const categorySection = resolveSection(visibleSections, "categories", ["services", "gallery"]);
  const productSection = resolveSection(visibleSections, "products", ["gallery", "services"]);
  const promoSection = resolveSection(visibleSections, "promo", ["pricing", "faq"]);
  const newsletterSection = resolveSection(visibleSections, "newsletter", ["contact"]);
  const aboutSection = resolveSection(visibleSections, "about", ["content"]);
  const page = resolvePage(path);
  const slides = useMemo(
    () =>
      buildSlides({
        hero: heroSection,
        mediaLibrary: builder.mediaLibrary ?? [],
        defaultTitle: data.website.heroTitle,
        defaultSubtitle: data.website.heroSubtitle,
        primaryCta: data.website.heroPrimaryCtaLabel,
        accent,
      }),
    [heroSection, builder.mediaLibrary, data.website.heroTitle, data.website.heroSubtitle, data.website.heroPrimaryCtaLabel, accent],
  );
  const categories = useMemo(
    () => buildCategoryCards({ section: categorySection, mediaLibrary: builder.mediaLibrary ?? [] }),
    [categorySection, builder.mediaLibrary],
  );
  const products = useMemo(
    () => buildProductGrid({ section: productSection, mediaLibrary: builder.mediaLibrary ?? [] }),
    [productSection, builder.mediaLibrary],
  );
  const promos = useMemo(() => buildPromos(promoSection), [promoSection]);
  const newsletter = useMemo(() => buildNewsletterCopy(newsletterSection), [newsletterSection]);
  const baseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${data.website.slug}${normalizePath(target)}`;
  const cartItems = products.slice(0, 3);
  const related = products.slice(1, 5);
  const inlineAccent = { ["--site-accent" as string]: accent };

  return (
    <div
      className="min-h-screen bg-white text-zinc-900 transition-colors dark:bg-zinc-950 dark:text-zinc-50"
      style={inlineAccent}
    >
      {mode === "preview" ? (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950">
          Prévisualisation — les liens internes utilisent le paramètre ?path=…
        </div>
      ) : null}
      <Navbar
        theme={theme}
        company={data.website.contact}
        categories={categories}
        baseLink={baseLink}
        cartCount={cartItems.length}
      />
      {page.page === "home" ? (
        <HomePage
          theme={theme}
          slides={slides}
          categories={categories}
          products={products}
          promos={promos}
          newsletter={newsletter}
          baseLink={baseLink}
        />
      ) : null}
      {page.page === "category" ? (
        <CategoryPage theme={theme} categories={categories} products={products} baseLink={baseLink} />
      ) : null}
      {page.page === "product" ? (
        <ProductPage theme={theme} product={products[0] ?? products[1]} related={related} baseLink={baseLink} />
      ) : null}
      {page.page === "cart" ? (
        <CartPage theme={theme} cartItems={cartItems} baseLink={baseLink} />
      ) : null}
      {page.page === "checkout" ? <CheckoutPage theme={theme} /> : null}
      {page.page === "about" ? (
        <AboutPage theme={theme} aboutSection={aboutSection} baseLink={baseLink} />
      ) : null}
      {page.page === "contact" ? (
        <ContactPage theme={theme} contactBlurb={data.website.contactBlurb} company={data.website.contact} />
      ) : null}
      <Footer theme={theme} company={data.website.contact} baseLink={baseLink} />
    </div>
  );
}
