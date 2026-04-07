"use client";

import clsx from "clsx";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  CartProvider,
  useCart,
  type CartProduct,
} from "@/components/website/cart/cart-context";
import { LeadCaptureForm } from "@/components/website/lead-form";
import { QuoteRequestForm } from "@/components/website/quote-request-form";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import {
  computeAdjustedUnitPriceTTCCents,
  resolveProductDiscount,
} from "@/lib/product-pricing";
import { slugify } from "@/lib/slug";
import { DEFAULT_PRIMARY_CTA_LABEL } from "@/lib/website/defaults";
import { WEBSITE_MEDIA_PLACEHOLDERS } from "@/lib/website/placeholders";
import type {
  WebsiteBuilderConfig,
  WebsiteBuilderMediaAsset,
  WebsiteBuilderSection,
} from "@/lib/website/builder";
import type { CatalogPayload } from "@/server/website";

type TemplateProps = {
  data: CatalogPayload;
  mode: "public" | "preview";
  path?: string | null;
};

type PageDescriptor =
  | { page: "home" }
  | { page: "catalogue"; categorySlug?: string }
  | { page: "product"; productSlug: string }
  | { page: "cart" }
  | { page: "checkout" }
  | { page: "confirmation" }
  | { page: "contact" };

type ThemeTokens = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  buttonShape: string;
  corner: string;
  containerClass: string;
  sectionSpacing: string;
};

type SaleMode = CatalogPayload["products"]["all"][number]["saleMode"];

type CheckoutPaymentMethod = "card" | "bank_transfer" | "cash_on_delivery";

type CatalogCard = CartProduct & {
  excerpt: string;
  description: string;
  gallery: string[];
  quoteFormSchema: unknown | null;
  category: string | null;
  categorySlug: string | null;
};

type CategoryOption = {
  slug: string;
  label: string;
};

type OrderLineSummary = {
  id: string;
  title: string;
  quantity: number;
  unitAmountCents: number | null;
  lineTotalCents: number | null;
};

type OrderConfirmation = {
  orderId: string | null;
  reference: string;
  currencyCode: string;
  totalAmountCents: number | null;
  items: OrderLineSummary[];
  createdAt: string;
};

type OrderApiResponse = {
  status?: string;
  message?: string;
  error?: string;
  order?: {
    id: string | null;
    orderNumber: string | null;
    currency: string;
    totalTTCCents: number;
    confirmationToken?: string | null;
    items: Array<{
      productId: string;
      title: string;
      quantity: number;
      unitAmountCents: number | null;
      lineTotalCents: number | null;
    }>;
  };
};

type CheckoutFieldErrors = {
  phone?: string;
  paymentMethod?: string;
  terms?: string;
};

type ProofCard = {
  id: string;
  quote: string;
  name: string;
  role: string;
};

type Metric = {
  label: string;
  value: string;
};

const spacingMap: Record<
  NonNullable<WebsiteBuilderConfig["theme"]>["sectionSpacing"],
  string
> = {
  compact: "py-12",
  comfortable: "py-16",
  spacious: "py-24",
};

const containerMap = {
  narrow: "max-w-5xl",
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

function normalizePath(path?: string | null): string {
  if (!path) return "/";
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function resolvePage(path?: string | null): PageDescriptor {
  const normalized = normalizePath(path);
  const segments = normalized.split("/").filter(Boolean);
  const [head, second, third] = segments;
  if (!head || head === "home" || head === "accueil") {
    return { page: "home" };
  }
  if (head === "categories" || head === "category" || head === "categorie") {
    return { page: "catalogue", categorySlug: second };
  }
  if (head === "catalogue" || head === "catalog" || head === "services") {
    if (second === "categories" || second === "category" || second === "categorie") {
      return { page: "catalogue", categorySlug: third };
    }
    return { page: "catalogue" };
  }
  if ((head === "produit" || head === "product" || head === "service") && second) {
    return { page: "product", productSlug: second };
  }
  if (head === "panier" || head === "cart") {
    return { page: "cart" };
  }
  if (head === "checkout" || head === "paiement" || head === "payment") {
    return { page: "checkout" };
  }
  if (head === "confirmation" || head === "merci") {
    return { page: "confirmation" };
  }
  if (head === "contact") {
    return { page: "contact" };
  }
  return { page: "home" };
}

function withAlpha(color: string, alphaHex: string) {
  if (!color.startsWith("#") || color.length !== 7) return color;
  return `${color}${alphaHex}`;
}

const DEFAULT_PRICE_LABEL = "Sur devis";
const PRODUCT_QUOTE_ANCHOR = "#demande-devis";

const COPY = {
  buttons: {
    quote: "Demander un devis",
    addToCart: "Ajouter au panier",
  },
  nav: {
    home: "Accueil",
    catalogue: "Catalogue",
    contact: "Contact",
    cart: "Panier",
    cta: "Demander un audit",
  },
  hero: {
    title: "Sites e-commerce qui convertissent vite",
    subtitle:
      "Stratégie, design et build pour accélérer vos revenus et votre image.",
    eyebrow: "Agence tech",
    secondaryCta: "Voir le catalogue",
    badges: ["Audit data + UX", "Sprints design", "Build full-stack"],
    locationFallback: "Tunis, Tunisie",
    previewAlt: "Aperçu hero",
    roadmapLabel: "Roadmap 30 jours",
    roadmapMetric: "Conversion +22 % sur les landing pages",
    roadmapTag: "Sprint",
  },
  services: {
    eyebrow: "Services",
    title: "Packs experts pour lancer ou optimiser vos ventes",
    subtitle:
      "Choisissez un pack et adaptez-le à votre budget. Chaque service inclut design, dev et tracking.",
    emptyTitle: "Catalogue en cours de mise à jour.",
    emptySubtitle:
      "Contactez-nous pour un devis rapide sur vos besoins e-commerce.",
    emptyCta: "Parler à un expert",
    viewAll: "Voir tout le catalogue",
    viewDetail: "Voir le détail",
  },
  proof: {
    eyebrow: "Preuves",
    title: "Des résultats mesurables, livre après livre",
    subtitle:
      "Nous monitorons la performance depuis la maquette jusqu'au checkout. Aucune intuition sans data.",
    defaultCards: [
      {
        id: "proof-1",
        quote:
          "Équipe hyper réactive. Lancement du MVP en 5 semaines et +38 % de leads.",
        name: "Sophie L.",
        role: "Head of Growth",
      },
      {
        id: "proof-2",
        quote:
          "Process clair, livrables solides, et une vraie culture de la data.",
        name: "Karim D.",
        role: "COO",
      },
      {
        id: "proof-3",
        quote:
          "Ils ont pris en main notre stack et aligné marketing + produit.",
        name: "Léa M.",
        role: "CEO",
      },
    ],
  },
  logos: {
    eyebrow: "Références",
    title: "Ils nous confient leur croissance e-commerce",
    subtitle: "Scale-ups, retailers et marques ambitieuses.",
    empty: "Ajoutez des logos pour renforcer la crédibilité.",
  },
  about: {
    eyebrow: "Méthode",
    title: "Une équipe senior pour vos sprints e-commerce",
    description:
      "Stratégie, design et build alignés sur vos objectifs de conversion.",
    empty: "Ajoutez vos points forts, chiffres clés ou certifications.",
  },
  gallery: {
    eyebrow: "Études de cas",
    title: "Projets livrés, mesurés, optimisés",
    subtitle: "Quelques missions récentes pour des marques ambitieuses.",
    empty: "Ajoutez des visuels ou études de cas.",
  },
  pricing: {
    eyebrow: "Packages",
    title: "Budgets clairs, livrables concrets",
    subtitle: "Des offres modulables pour s'aligner sur votre roadmap.",
    empty: "Ajoutez vos packs et tarifs.",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions fréquentes",
    subtitle: "Transparence sur nos délais, process et garanties.",
    empty: "Ajoutez vos questions clés.",
  },
  metrics: [
    { label: "Délai moyen", value: "6 semaines" },
    { label: "Sprints livrés", value: "120+" },
    { label: "Satisfaction", value: "4,9/5" },
  ],
  cta: {
    eyebrow: "Appel à l'action",
    title: "Passez de la vision à la conversion",
    description: "Recevez une recommandation en 48 h avec scope, budget et planning.",
    tags: ["Audit express", "Plan produit", "Livraison garantie"],
    primary: "Planifier une session",
    secondary: "Explorer les offres",
  },
  catalogue: {
    eyebrow: "Catalogue",
    title: "Choisissez le pack adapté à votre roadmap",
    subtitle:
      "Packs modulables, équipe senior et delivery rapide. Chaque offre est conçue pour scaler.",
    filterAll: "Tous",
    searchLabel: "Rechercher dans le catalogue",
    searchPlaceholder: "Rechercher un service",
    searchCta: "Rechercher",
    emptyTitle: "Aucun service disponible pour le moment.",
    emptySubtitle:
      "Revenez bientôt ou contactez-nous pour un devis sur mesure.",
    emptyCta: "Nous contacter",
    viewProduct: "Voir la fiche",
  },
  product: {
    notFoundEyebrow: "Produit indisponible",
    notFoundTitle: "Ce service n'existe pas ou n'est plus disponible.",
    notFoundSubtitle:
      "Consultez le catalogue ou contactez-nous pour une solution sur mesure.",
    backToCatalogue: "Retour au catalogue",
    contact: "Nous contacter",
    galleryLabel: "Galerie du service",
    galleryZoom: "Agrandir l'image",
    galleryClose: "Fermer l'aperçu",
    galleryPrev: "Image précédente",
    galleryNext: "Image suivante",
    galleryThumbLabel: "Aperçu",
    deliveryTitle: "Livrables inclus",
    deliverables: [
      "Audit data + quick wins",
      "Design system et maquettes",
      "Stack e-commerce + monitoring",
      "Formation équipe interne",
    ],
    upsellEyebrow: "Services complémentaires",
    upsellTitle: "Complétez votre roadmap",
    upsellSubtitle:
      "Ajoutez un service connexe pour maximiser l'impact de votre projet.",
    upsellEmpty:
      "Ajoutez des services en vedette pour enrichir cette section.",
    upsellViewAll: "Voir tout le catalogue",
    quoteEyebrow: "Demande de devis",
    quoteTitle: "Parlons de votre projet",
    quoteSubtitle: "Décrivez vos enjeux, nous vous répondons sous 48 h.",
    quoteUnavailable: "Le formulaire de devis n'est pas disponible pour ce produit.",
    tagDuration: "4-6 semaines",
    tagSprint: "Sprint first",
  },
  cart: {
    label: "Panier",
    emptyTitle: "Votre panier est vide",
    emptySubtitle: "Ajoutez un service pour démarrer votre projet e-commerce.",
    exploreCatalogue: "Explorer le catalogue",
    title: "Votre panier",
    quantityLabel: "Quantité",
    remove: "Retirer",
    summaryTitle: "Résumé",
    summaryServices: "Services",
    summarySubtotal: "Sous-total HT",
    summaryDiscount: "Remise",
    summaryTax: "TVA",
    summaryTotal: "Total TTC",
    checkout: "Passer au paiement",
    pricingHidden:
      "Les tarifs sont masqués pour ce site. Contactez-nous pour finaliser votre commande.",
    missingPrice:
      "Certains services n'ont pas de prix. Contactez-nous pour finaliser votre commande.",
  },
  checkout: {
    title: "Paiement",
    emptyTitle: "Panier vide",
    emptySubtitle: "Ajoutez un service pour passer au paiement.",
    missingPrice: "Certains services n'ont pas de prix. Contactez-nous pour finaliser la commande.",
    missingPriceWarning:
      "Certains services n'ont pas de prix. Merci de nous contacter pour finaliser la commande.",
    pricingHidden:
      "Les tarifs sont masqués pour ce site. Contactez-nous pour finaliser la commande.",
    pricingHiddenWarning:
      "Les tarifs sont masqués. Merci de nous contacter pour finaliser la commande.",
    fieldErrors: "Merci de corriger les champs signalés.",
    confirm: "Confirmez vos coordonnées avant validation.",
    labelName: "Prénom et nom",
    labelEmail: "E-mail",
    labelPhone: "Téléphone",
    labelCompany: "Société",
    labelAddress: "Adresse",
    labelNotes: "Notes",
    notesPlaceholder: (currencyCode: string) =>
      `Ajoutez vos contraintes, délais, budget (${currencyCode}).`,
    phoneRequired: "Le téléphone est requis pour finaliser la commande.",
    termsLabel: "J'accepte les conditions générales",
    termsLinkLabel: "Lire les conditions",
    termsRequired: "Veuillez accepter les conditions pour continuer.",
    paymentTitle: "Mode de paiement",
    paymentHint: "Sélectionnez le mode souhaité.",
    paymentRequired: "Veuillez sélectionner un mode de paiement.",
    paymentCard: "Carte bancaire",
    paymentBankTransfer: "Virement bancaire",
    paymentCashOnDelivery: "Paiement à la livraison",
    submitLoading: "Validation en cours...",
    submitIdle: "Confirmer la commande",
    summaryTitle: "Résumé",
    summaryTotal: "Total",
    quantityLabel: "Quantité",
    bankTransferTitle: "Virement bancaire",
    bankTransferFallback:
      "Les coordonnées de virement seront communiquées après validation.",
    bankTransferDefault:
      "Paiement sur facture ou virement bancaire selon votre workflow.",
    errorCreate: "Impossible de créer la commande.",
    errorPayment: "Impossible d'ouvrir la session de paiement.",
  },
  confirmation: {
    title: "Commande confirmée",
    subtitle:
      "Merci. Nous revenons vers vous sous 24 h pour finaliser les prochaines étapes.",
    summaryLabel: "Référence",
    summaryTotal: "Total",
    emptySummary: "Aucun récapitulatif disponible. Revenez au catalogue pour continuer.",
    bankTransferTitle: "Virement bancaire",
    proofLabel: "Preuve de virement",
    proofUpload: "Envoyer la preuve",
    proofUploading: "Envoi en cours...",
    proofSuccess: "Preuve envoyée. Nous confirmons le paiement rapidement.",
    proofMissingOrder: "Référence de commande introuvable.",
    proofMissingFile: "Veuillez sélectionner un fichier.",
    proofUploadFailed: "Impossible d'envoyer la preuve.",
    previewNote: "Mode prévisualisation : l'envoi de preuve est désactivé.",
    proofMissingReference: "Référence de commande indisponible pour l'upload.",
    backToCatalogue: "Retour au catalogue",
  },
  contact: {
    eyebrow: "Contact",
    title: "Parlez-nous de votre croissance e-commerce en Tunisie",
    subtitle:
      "Expliquez vos objectifs, votre stack et votre calendrier. On revient vite.",
    labelEmail: "Email",
    labelPhone: "Téléphone",
    labelAddress: "Adresse",
    fallbackEmail: "contact@studio.tn",
    fallbackPhone: "+216 71 000 000",
    fallbackAddress: "Tunis, Tunisie",
  },
  footer: {
    tagline: "Agence tech e-commerce - stratégie, design, build.",
    rights: "Tous droits réservés",
  },
  misc: {
    previewBanner: "Mode prévisualisation — les liens internes utilisent ?path=",
    serviceExcerpt: "Service digital orienté performance.",
    proofQuoteFallback: "Retour client à personnaliser.",
    proofRoleFallback: "Équipe produit",
  },
} as const;

function normalizeGallery(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if (typeof record.src === "string") return record.src.trim();
        if (typeof record.url === "string") return record.url.trim();
      }
      return "";
    })
    .filter((entry): entry is string => entry.length > 0);
}

function buildProductImages(
  coverImageUrl: string | null | undefined,
  galleryValue: unknown,
  fallbackIndex: number,
): string[] {
  const gallery = normalizeGallery(galleryValue);
  const images: string[] = [];
  if (coverImageUrl) {
    images.push(coverImageUrl);
  }
  gallery.forEach((image) => {
    if (!images.includes(image)) {
      images.push(image);
    }
  });
  if (!images.length) {
    images.push(
      WEBSITE_MEDIA_PLACEHOLDERS.gallery[
        fallbackIndex % WEBSITE_MEDIA_PLACEHOLDERS.gallery.length
      ],
    );
  }
  return images;
}

function resolveProductSlug(
  product: CatalogPayload["products"]["all"][number],
) {
  if (product.publicSlug && product.publicSlug.trim().length > 0) {
    return product.publicSlug;
  }
  const base = product.sku || product.name || product.id;
  return slugify(base) || product.id.slice(0, 8);
}

function resolvePriceLabel(options: {
  saleMode: SaleMode;
  showPrices: boolean;
  amountCents?: number;
  currencyCode?: string;
  label?: string | null;
}) {
  if (options.saleMode === "QUOTE" || !options.showPrices) {
    return DEFAULT_PRICE_LABEL;
  }
  if (options.amountCents !== undefined && options.currencyCode) {
    return formatCurrency(
      fromCents(options.amountCents, options.currencyCode),
      options.currencyCode,
    );
  }
  return options.label ?? DEFAULT_PRICE_LABEL;
}

const ORDER_CONFIRMATION_PREFIX = "catalogue-order";

function buildOrderStorageKey(websiteId: string) {
  return `${ORDER_CONFIRMATION_PREFIX}:${websiteId}`;
}

function readOrderConfirmation(storageKey: string): OrderConfirmation | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrderConfirmation;
    if (!parsed?.reference) return null;
    if (!Array.isArray(parsed.items)) return null;
    return {
      ...parsed,
      orderId: parsed.orderId ?? null,
    };
  } catch {
    return null;
  }
}

function writeOrderConfirmation(
  storageKey: string,
  confirmation: OrderConfirmation,
) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify(confirmation),
    );
  } catch {
    // Ignore storage write failures.
  }
}

function resolveCtaLabel(saleMode: SaleMode) {
  return saleMode === "QUOTE" ? COPY.buttons.quote : COPY.buttons.addToCart;
}

function resolveCtaHref(options: {
  saleMode: SaleMode;
  baseLink: (target: string) => string;
  productSlug?: string | null;
  quoteAnchor?: string;
}) {
  if (options.saleMode === "QUOTE") {
    if (options.productSlug) {
      const anchor = options.quoteAnchor ?? PRODUCT_QUOTE_ANCHOR;
      return `${options.baseLink(`/produit/${options.productSlug}`)}${anchor}`;
    }
    return options.baseLink("/contact");
  }
  return options.baseLink("/panier");
}

const CATALOGUE_PATH = "/catalogue";
const CATEGORY_PATH = "/categories";

function normalizeCategorySlug(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  if (normalized === "all" || normalized === "tous") return null;
  return slugify(normalized) || null;
}

function buildCategoryOptions(cards: CatalogCard[]): CategoryOption[] {
  const options = new Map<string, string>();
  cards.forEach((card) => {
    if (!card.category || !card.categorySlug) return;
    if (!options.has(card.categorySlug)) {
      options.set(card.categorySlug, card.category);
    }
  });
  return Array.from(options, ([slug, label]) => ({ slug, label })).sort(
    (left, right) => left.label.localeCompare(right.label),
  );
}

function buildCategoryHref(options: {
  baseLink: (target: string) => string;
  categorySlug?: string | null;
  search?: string;
}) {
  const target = options.categorySlug
    ? `${CATEGORY_PATH}/${options.categorySlug}`
    : CATALOGUE_PATH;
  const base = options.baseLink(target);
  if (!options.search) return base;
  const params = new URLSearchParams();
  params.set("search", options.search);
  return `${base}?${params.toString()}`;
}

function isInstantPurchase(card: Pick<CartProduct, "saleMode" | "unitAmountCents">) {
  return card.saleMode === "INSTANT" && card.unitAmountCents != null;
}

function resolveMedia(
  mediaId: string | null | undefined,
  mediaLibrary: WebsiteBuilderMediaAsset[],
  fallback: string,
) {
  if (!mediaId) return fallback;
  const asset = mediaLibrary.find((entry) => entry.id === mediaId);
  return asset?.src ?? fallback;
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

function resolveLink(
  href: string | null | undefined,
  baseLink: (target: string) => string,
  fallback: string,
) {
  if (!href) return baseLink(fallback);
  if (href.startsWith("http")) return href;
  if (href.startsWith("#")) return href;
  return baseLink(href);
}

function buildServiceCards(options: {
  products: CatalogPayload["products"]["all"];
  currencyCode: string;
  showPrices: boolean;
}): CatalogCard[] {
  if (!options.products.length) return [];
  return options.products.map((product, index) => {
    const gallery = buildProductImages(
      product.coverImageUrl,
      product.gallery,
      index,
    );
    const excerpt =
      product.excerpt ??
      product.description ??
      COPY.misc.serviceExcerpt;
    const unitPriceHTCents =
      product.saleMode === "INSTANT" ? product.priceHTCents : null;
    const vatRate = product.saleMode === "INSTANT" ? product.vatRate : null;
    const discount = resolveProductDiscount(product);
    const unitAmountCents = computeAdjustedUnitPriceTTCCents({
      saleMode: product.saleMode,
      priceTTCCents: product.priceTTCCents ?? null,
      priceHTCents: unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
    });
    const category = product.category?.trim() ?? null;
    const categorySlug = category ? slugify(category) || null : null;
    return {
      id: product.id,
      title: product.name,
      excerpt,
      description: product.description ?? excerpt,
      tag: category ?? "Service",
      category,
      categorySlug,
      price: resolvePriceLabel({
        saleMode: product.saleMode,
        showPrices: options.showPrices,
        amountCents: unitAmountCents ?? undefined,
        currencyCode: options.currencyCode,
      }),
      unitAmountCents,
      unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
      currencyCode: options.currencyCode,
      slug: resolveProductSlug(product),
      image: gallery[0],
      gallery,
      saleMode: product.saleMode,
      quoteFormSchema: product.quoteFormSchema ?? null,
    };
  });
}

function buildProofCards(section?: WebsiteBuilderSection | null): ProofCard[] {
  const items = section?.items?.length ? section.items : [];
  if (items.length) {
    return items.slice(0, 3).map((item, index) => ({
      id: item.id,
      quote: item.description ?? COPY.misc.proofQuoteFallback,
      name: item.title ?? `Client ${index + 1}`,
      role: item.tag ?? COPY.misc.proofRoleFallback,
    }));
  }
  return COPY.proof.defaultCards.map((item) => ({ ...item }));
}

function buildMetrics(): Metric[] {
  return COPY.metrics.map((item) => ({ ...item }));
}

function Section({
  theme,
  section,
  id,
  className,
  children,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      data-builder-section={section?.id}
      className={clsx(theme.sectionSpacing, className)}
    >
      <div className={clsx("mx-auto px-6 sm:px-8", theme.containerClass)}>
        {children}
      </div>
    </section>
  );
}

function Navbar({
  theme,
  baseLink,
  company,
}: {
  theme: ThemeTokens;
  baseLink: (target: string) => string;
  company: CatalogPayload["website"]["contact"];
}) {
  const { totalItems } = useCart();
  const cartCountLabel = `${totalItems} service${totalItems > 1 ? "s" : ""}`;
  const cartStatusLabel = `${COPY.nav.cart}: ${cartCountLabel}`;
  const navItems = [
    { label: COPY.nav.home, href: baseLink("/") },
    { label: COPY.nav.catalogue, href: baseLink("/catalogue") },
    { label: COPY.nav.contact, href: baseLink("/contact") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/85 backdrop-blur">
      <div
        className={clsx(
          "mx-auto flex items-center justify-between gap-4 px-6 py-4 sm:px-8",
          theme.containerClass,
        )}
      >
        <a
          href={baseLink("/")}
          className="group flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.32em] text-slate-900"
        >
          <span
            className={clsx(
              "flex h-10 w-10 items-center justify-center border border-black/10 bg-white text-xs",
              theme.corner,
            )}
            style={{ color: "var(--site-accent)" }}
          >
            {company.companyName.slice(0, 2)}
          </span>
          <span className="hidden sm:inline">{company.companyName}</span>
        </a>
        <nav className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 md:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="hover:text-slate-900 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={baseLink("/panier")}
            aria-label={cartStatusLabel}
            className="relative rounded-full border border-black/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {COPY.nav.cart}
            <span
              aria-hidden="true"
              className="ml-2 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-white"
            >
              {totalItems}
            </span>
          </a>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {cartStatusLabel}
          </span>
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "bg-[var(--site-accent)] px-4 text-white shadow-[0_24px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
            )}
          >
            <a href={baseLink("/contact")}>{COPY.nav.cta}</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function HeroSection({
  theme,
  section,
  baseLink,
  company,
  mediaLibrary,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  baseLink: (target: string) => string;
  company: CatalogPayload["website"]["contact"];
  mediaLibrary: WebsiteBuilderMediaAsset[];
}) {
  const title = section?.title ?? COPY.hero.title;
  const subtitle =
    section?.subtitle ??
    COPY.hero.subtitle;
  const eyebrow = section?.eyebrow ?? COPY.hero.eyebrow;
  const heroImage = resolveMedia(
    section?.mediaId,
    mediaLibrary,
    WEBSITE_MEDIA_PLACEHOLDERS.hero,
  );
  const primaryLabel =
    section?.buttons?.[0]?.label ?? DEFAULT_PRIMARY_CTA_LABEL;
  const secondaryLabel = section?.buttons?.[1]?.label ?? COPY.hero.secondaryCta;
  const primaryHref = resolveLink(
    section?.buttons?.[0]?.href,
    baseLink,
    "/contact",
  );
  const secondaryHref = resolveLink(
    section?.buttons?.[1]?.href,
    baseLink,
    "/catalogue",
  );
  const badges = COPY.hero.badges;
  const contactEmail =
    company.email ??
    `contact@${company.companyName.toLowerCase().replace(/\s+/g, "")}.tn`;
  const location = company.address ?? COPY.hero.locationFallback;

  return (
    <Section theme={theme} section={section} id="hero">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="text-lg leading-relaxed text-slate-600">
            {subtitle}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "bg-[var(--site-accent)] px-6 text-white shadow-[0_25px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
              )}
            >
              <a href={primaryHref}>{primaryLabel}</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className={clsx(
                theme.buttonShape,
                "border border-black/10 px-6 text-slate-800 hover:bg-black/5",
              )}
            >
              <a href={secondaryHref}>{secondaryLabel}</a>
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-black/10 bg-white/80 px-3 py-1"
              >
                {badge}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">
              {company.companyName}
            </span>
            <span>{location}</span>
            <span>{contactEmail}</span>
          </div>
        </div>
        <div className="relative">
          <div
            className={clsx(
              "relative overflow-hidden border border-black/10 bg-white/90 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.35)]",
              theme.corner,
            )}
          >
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.15),transparent)]" />
            <Image
              src={heroImage}
              alt={COPY.hero.previewAlt}
              width={960}
              height={780}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <div className="absolute -bottom-6 left-6 w-[85%] rounded-3xl border border-black/10 bg-white/95 p-6 text-sm shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {COPY.hero.roadmapLabel}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {COPY.hero.roadmapMetric}
                </p>
              </div>
              <div className="rounded-2xl bg-black px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                {COPY.hero.roadmapTag}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ServicesSection({
  theme,
  section,
  cards,
  baseLink,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
}) {
  const { addItem } = useCart();
  const eyebrow = section?.eyebrow ?? COPY.services.eyebrow;
  const title =
    section?.title ?? COPY.services.title;
  const subtitle =
    section?.subtitle ??
    section?.description ??
    COPY.services.subtitle;

  if (!cards.length) {
    return (
      <Section theme={theme} section={section} id="services">
        <div className="flex flex-col gap-8">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {eyebrow}
            </p>
            <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {title}
            </h2>
            <p className="text-base text-slate-600">
              {subtitle}
            </p>
          </div>
          <div
            className={clsx(
              "rounded-3xl border border-black/10 bg-white p-6 text-sm text-slate-600 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
              theme.corner,
            )}
          >
            <p className="text-base font-semibold text-slate-900">
              {COPY.services.emptyTitle}
            </p>
            <p className="mt-2">
              {COPY.services.emptySubtitle}
            </p>
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "mt-4 bg-[var(--site-accent)] px-5 text-white shadow-[0_25px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
              )}
            >
              <a href={baseLink("/contact")}>{COPY.services.emptyCta}</a>
            </Button>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section theme={theme} section={section} id="services">
      <div className="flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {eyebrow}
            </p>
            <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {title}
            </h2>
            <p className="text-base text-slate-600">
              {subtitle}
            </p>
          </div>
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "border border-black/10 bg-white px-5 text-sm text-slate-800 hover:bg-black/5",
            )}
            variant="ghost"
          >
            <a href={baseLink("/catalogue")}>{COPY.services.viewAll}</a>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card, index) => {
            const canAddToCart = isInstantPurchase(card);
            return (
              <div
                key={card.id}
                className={clsx(
                  "group flex h-full flex-col overflow-hidden border border-black/10 bg-white shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)] transition",
                  theme.corner,
                  "animate-[reveal_0.8s_ease-out_both]",
                )}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="relative h-48 overflow-hidden">
                  <Image
                    src={card.image}
                    alt={card.title}
                    width={640}
                    height={420}
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-6">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                    <span>{card.tag}</span>
                    <span className="text-slate-900">{card.price}</span>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {card.title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {card.excerpt}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between text-sm font-semibold">
                    <a
                      href={baseLink(`/produit/${card.slug}`)}
                      className="text-slate-900"
                    >
                      {COPY.services.viewDetail}
                    </a>
                    {canAddToCart ? (
                      <button
                        type="button"
                        onClick={() => addItem(card)}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5"
                      >
                        {resolveCtaLabel(card.saleMode)}
                      </button>
                    ) : (
                      <a
                        href={resolveCtaHref({
                          saleMode: card.saleMode,
                          baseLink,
                          productSlug: card.slug,
                          quoteAnchor: PRODUCT_QUOTE_ANCHOR,
                        })}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5"
                      >
                        {resolveCtaLabel(card.saleMode)}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function LogosSection({
  theme,
  section,
  mediaLibrary,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
}) {
  if (!section) return null;
  const layout = section.layout ?? "grid";
  const items = section.items ?? [];
  const eyebrow = section.eyebrow ?? COPY.logos.eyebrow;
  const title = section.title ?? COPY.logos.title;
  const subtitle =
    section.subtitle ?? section.description ?? COPY.logos.subtitle;

  const renderLogo = (
    item: WebsiteBuilderSection["items"][number],
    index: number,
    isDuplicate: boolean,
  ) => {
    const placeholderIndex = items.length ? index % items.length : index;
    const logoSrc = resolveMedia(
      item.mediaId,
      mediaLibrary,
      WEBSITE_MEDIA_PLACEHOLDERS.logos[
        placeholderIndex % WEBSITE_MEDIA_PLACEHOLDERS.logos.length
      ],
    );
    const label = item.title ?? `Logo ${index + 1}`;
    return (
      <div
        key={`${item.id}-${index}`}
        className={clsx(
          "flex h-16 w-40 items-center justify-center border border-black/10 bg-white px-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)]",
          theme.corner,
        )}
        aria-hidden={isDuplicate}
      >
        <Image
          src={logoSrc}
          alt={label}
          width={220}
          height={80}
          className="max-h-10 w-auto object-contain"
        />
      </div>
    );
  };

  return (
    <Section theme={theme} section={section} id="logos">
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-base text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {items.length ? (
          layout === "marquee" ? (
            <div
              className={clsx(
                "relative overflow-hidden border border-black/10 bg-white/80",
                theme.corner,
              )}
            >
              <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white via-white/80 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white via-white/80 to-transparent" />
              <div className="flex w-max items-center gap-8 px-6 py-6 animate-[marquee_28s_linear_infinite]">
                {items.concat(items).map((item, index) =>
                  renderLogo(item, index, index >= items.length),
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {items.map((item, index) => renderLogo(item, index, false))}
            </div>
          )
        ) : (
          <div
            className={clsx(
              "rounded-3xl border border-dashed border-black/15 bg-white/70 p-6 text-sm text-slate-600",
              theme.corner,
            )}
          >
            {COPY.logos.empty}
          </div>
        )}
      </div>
    </Section>
  );
}

function AboutSection({
  theme,
  section,
  mediaLibrary,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
}) {
  if (!section) return null;
  const layout = section.layout ?? "split";
  const eyebrow = section.eyebrow ?? COPY.about.eyebrow;
  const title = section.title ?? COPY.about.title;
  const description =
    section.description ?? section.subtitle ?? COPY.about.description;
  const items = section.items ?? [];
  const imageSrc = resolveMedia(
    section.mediaId,
    mediaLibrary,
    WEBSITE_MEDIA_PLACEHOLDERS.about,
  );
  const isStack = layout === "stack";

  return (
    <Section theme={theme} section={section} id="about">
      <div
        className={clsx(
          "grid gap-10 lg:items-center",
          isStack
            ? "lg:grid-cols-1"
            : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]",
        )}
      >
        <div className={clsx("space-y-6", isStack ? "order-2" : "")}>
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {title}
            </h2>
            <p className="text-base text-slate-600">{description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <div
                key={item.id}
                className={clsx(
                  "rounded-3xl border border-black/10 bg-white/90 p-5 text-sm text-slate-600 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)]",
                  theme.corner,
                )}
              >
                <p className="text-base font-semibold text-slate-900">
                  {item.title ?? "Point fort"}
                </p>
                {item.description ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {item.description}
                  </p>
                ) : null}
              </div>
            ))}
            {items.length === 0 ? (
              <div
                className={clsx(
                  "rounded-3xl border border-dashed border-black/15 bg-white/70 p-5 text-sm text-slate-600",
                  theme.corner,
                )}
              >
                {COPY.about.empty}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={clsx(
            "overflow-hidden border border-black/10 bg-white/90 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.25)]",
            theme.corner,
            isStack ? "order-1" : "",
          )}
        >
          <Image
            src={imageSrc}
            alt={title}
            width={880}
            height={960}
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </Section>
  );
}

function GallerySection({
  theme,
  section,
  mediaLibrary,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
}) {
  if (!section) return null;
  const layout = section.layout ?? "grid";
  const items = section.items ?? [];
  const eyebrow = section.eyebrow ?? COPY.gallery.eyebrow;
  const title = section.title ?? COPY.gallery.title;
  const subtitle =
    section.subtitle ?? section.description ?? COPY.gallery.subtitle;
  const isMasonry = layout === "masonry";
  const aspectVariants = ["aspect-[5/4]", "aspect-[4/5]", "aspect-[1/1]"];

  return (
    <Section theme={theme} section={section} id="gallery">
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-base text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {items.length ? (
          <div
            className={clsx(
              isMasonry
                ? "columns-1 [column-gap:1.5rem] sm:columns-2 lg:columns-3"
                : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {items.map((item, index) => {
              const imageSrc = resolveMedia(
                item.mediaId,
                mediaLibrary,
                WEBSITE_MEDIA_PLACEHOLDERS.gallery[
                  index % WEBSITE_MEDIA_PLACEHOLDERS.gallery.length
                ],
              );
              const aspectClass = isMasonry
                ? aspectVariants[index % aspectVariants.length]
                : "aspect-[4/3]";
              return (
                <article
                  key={item.id}
                  className={clsx(
                    "overflow-hidden border border-black/10 bg-white shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
                    theme.corner,
                    isMasonry ? "mb-6 break-inside-avoid" : "",
                  )}
                >
                  <div className={clsx("relative", aspectClass)}>
                    <Image
                      src={imageSrc}
                      alt={item.title ?? "Projet"}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-5">
                    <p className="text-base font-semibold text-slate-900">
                      {item.title ?? "Projet e-commerce"}
                    </p>
                    {item.description ? (
                      <p className="text-sm text-slate-600">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div
            className={clsx(
              "rounded-3xl border border-dashed border-black/15 bg-white/70 p-6 text-sm text-slate-600",
              theme.corner,
            )}
          >
            {COPY.gallery.empty}
          </div>
        )}
      </div>
    </Section>
  );
}

function PricingSection({
  theme,
  section,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
}) {
  if (!section) return null;
  const layout = section.layout ?? "grid";
  const items = section.items ?? [];
  const eyebrow = section.eyebrow ?? COPY.pricing.eyebrow;
  const title = section.title ?? COPY.pricing.title;
  const subtitle =
    section.subtitle ?? section.description ?? COPY.pricing.subtitle;
  const gridClass =
    layout === "stack" ? "space-y-4" : "grid gap-6 md:grid-cols-3";

  return (
    <Section theme={theme} section={section} id="pricing">
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-base text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {items.length ? (
          <div className={gridClass}>
            {items.map((plan) => (
              <article
                key={plan.id}
                className={clsx(
                  "flex h-full flex-col gap-4 border border-black/10 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
                  theme.corner,
                )}
              >
                {plan.tag ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    {plan.tag}
                  </p>
                ) : null}
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    {plan.title ?? "Pack"}
                  </h3>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">
                    {plan.price ?? DEFAULT_PRICE_LABEL}
                  </p>
                </div>
                {plan.description ? (
                  <p className="text-sm text-slate-600">{plan.description}</p>
                ) : null}
                {plan.stats && plan.stats.length ? (
                  <ul className="space-y-2 text-sm text-slate-600">
                    {plan.stats.map((feature) => (
                      <li key={feature.id} className="flex items-start gap-2">
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--site-accent)]" />
                        <span>
                          {feature.label}
                          {feature.value ? ` — ${feature.value}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {plan.linkLabel ? (
                  <a
                    href={plan.href ?? "#contact"}
                    className="mt-auto text-xs font-semibold uppercase tracking-[0.3em] text-[var(--site-accent)]"
                  >
                    {plan.linkLabel}
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div
            className={clsx(
              "rounded-3xl border border-dashed border-black/15 bg-white/70 p-6 text-sm text-slate-600",
              theme.corner,
            )}
          >
            {COPY.pricing.empty}
          </div>
        )}
      </div>
    </Section>
  );
}

function FaqSection({
  theme,
  section,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
}) {
  if (!section) return null;
  const layout = section.layout ?? "accordion";
  const items = section.items ?? [];
  const eyebrow = section.eyebrow ?? COPY.faq.eyebrow;
  const title = section.title ?? COPY.faq.title;
  const subtitle = section.subtitle ?? section.description ?? COPY.faq.subtitle;

  return (
    <Section theme={theme} section={section} id="faq">
      <div className="space-y-8">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-base text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {items.length ? (
          layout === "two-columns" ? (
            <div className="grid gap-6 md:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={clsx(
                    "rounded-3xl border border-black/10 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.18)]",
                    theme.corner,
                  )}
                >
                  <p className="text-base font-semibold text-slate-900">
                    {item.title ?? "Question fréquente"}
                  </p>
                  {item.description ? (
                    <p className="mt-2 text-sm text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <details
                  key={item.id}
                  className={clsx(
                    "rounded-2xl border border-black/10 bg-white/90 p-5 text-left shadow-[0_18px_40px_-32px_rgba(15,23,42,0.18)]",
                    theme.corner,
                  )}
                >
                  <summary className="cursor-pointer text-base font-semibold text-slate-900">
                    {item.title ?? "Question fréquente"}
                  </summary>
                  {item.description ? (
                    <p className="mt-3 text-sm text-slate-600">
                      {item.description}
                    </p>
                  ) : null}
                </details>
              ))}
            </div>
          )
        ) : (
          <div
            className={clsx(
              "rounded-3xl border border-dashed border-black/15 bg-white/70 p-6 text-sm text-slate-600",
              theme.corner,
            )}
          >
            {COPY.faq.empty}
          </div>
        )}
      </div>
    </Section>
  );
}

function ProofSection({
  theme,
  section,
  proofs,
  metrics,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  proofs: ProofCard[];
  metrics: Metric[];
}) {
  const eyebrow = section?.eyebrow ?? COPY.proof.eyebrow;
  const title =
    section?.title ?? COPY.proof.title;
  const subtitle =
    section?.subtitle ??
    section?.description ??
    COPY.proof.subtitle;

  return (
    <Section theme={theme} section={section} id="proofs">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
            {eyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            {title}
          </h2>
          <p className="text-base text-slate-600">
            {subtitle}
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-black/10 bg-white/90 p-4 text-center shadow-[0_18px_40px_-32px_rgba(15,23,42,0.2)]"
              >
                <p className="text-lg font-semibold text-slate-900">
                  {metric.value}
                </p>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          {proofs.map((proof) => (
            <div
              key={proof.id}
              className={clsx(
                "flex flex-col gap-4 border border-black/10 bg-white/95 p-6 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)]",
                theme.corner,
              )}
            >
              <p className="text-sm leading-relaxed text-slate-600">
                &ldquo;{proof.quote}&rdquo;
              </p>
              <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
                <span className="text-slate-900">{proof.name}</span> - {proof.role}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CtaSection({
  theme,
  section,
  baseLink,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  baseLink: (target: string) => string;
}) {
  const title =
    section?.title ?? COPY.cta.title;
  const description =
    section?.subtitle ??
    COPY.cta.description;
  return (
    <Section theme={theme} section={section} id="cta">
      <div
        className={clsx(
          "relative overflow-hidden border border-black/10 bg-white px-8 py-12 shadow-[0_40px_80px_-60px_rgba(15,23,42,0.4)] sm:px-12",
          theme.corner,
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--site-accent-soft),transparent_70%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)] lg:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {COPY.cta.eyebrow}
            </p>
            <h3 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {title}
            </h3>
            <p className="text-base text-slate-600">{description}</p>
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {COPY.cta.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-black/10 bg-white px-3 py-1"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
              )}
            >
              <a href={baseLink("/contact")}>{COPY.cta.primary}</a>
            </Button>
            <Button
              asChild
              variant="ghost"
              className={clsx(
                theme.buttonShape,
                "border border-black/10 bg-white px-6 text-sm text-slate-700 hover:bg-black/5",
              )}
            >
              <a href={baseLink("/catalogue")}>{COPY.cta.secondary}</a>
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function CataloguePage({
  theme,
  cards,
  baseLink,
  categorySlug,
}: {
  theme: ThemeTokens;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
  categorySlug?: string | null;
}) {
  const { addItem } = useCart();
  const searchParams = useSearchParams();
  const rawSearch = searchParams.get("search") ?? "";
  const searchValue = rawSearch.trim();
  const normalizedSearch = searchValue.toLowerCase();
  const pathCategorySlug = normalizeCategorySlug(categorySlug ?? null);
  const queryCategorySlug = normalizeCategorySlug(searchParams.get("category"));
  const activeCategorySlug = pathCategorySlug ?? queryCategorySlug;
  const categoryOptions = useMemo(
    () => buildCategoryOptions(cards),
    [cards],
  );
  const filterOptions = useMemo(
    () => [
      { slug: null, label: COPY.catalogue.filterAll },
      ...categoryOptions,
    ],
    [categoryOptions],
  );
  const filteredCards = useMemo(() => {
    if (!activeCategorySlug && !normalizedSearch) return cards;
    return cards.filter((card) => {
      if (activeCategorySlug) {
        if (!card.categorySlug || card.categorySlug !== activeCategorySlug) {
          return false;
        }
      }
      if (!normalizedSearch) return true;
      const haystack = [
        card.title,
        card.excerpt,
        card.description,
        card.tag ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [activeCategorySlug, cards, normalizedSearch]);
  const searchAction = buildCategoryHref({
    baseLink,
    categorySlug: activeCategorySlug ?? null,
  });
  return (
    <main>
      <Section theme={theme} id="catalogue">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {COPY.catalogue.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold text-slate-950 sm:text-5xl">
              {COPY.catalogue.title}
            </h1>
            <p className="text-base text-slate-600">
              {COPY.catalogue.subtitle}
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((filter) => {
                const isActive = filter.slug
                  ? filter.slug === activeCategorySlug
                  : !activeCategorySlug;
                return (
                  <a
                    key={filter.slug ?? "all"}
                    href={buildCategoryHref({
                      baseLink,
                      categorySlug: filter.slug,
                      search: searchValue || undefined,
                    })}
                    aria-current={isActive ? "page" : undefined}
                    className={clsx(
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] transition",
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-black/10 bg-white text-slate-500 hover:border-slate-900/40 hover:text-slate-900",
                    )}
                  >
                    {filter.label}
                  </a>
                );
              })}
            </div>
            <form
              action={searchAction}
              method="get"
              className="flex w-full max-w-sm items-center gap-2"
            >
              <label className="sr-only" htmlFor="catalogue-search">
                {COPY.catalogue.searchLabel}
              </label>
              <input
                id="catalogue-search"
                name="search"
                type="search"
                defaultValue={searchValue}
                placeholder={COPY.catalogue.searchPlaceholder}
                className={clsx(
                  "w-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-slate-900",
                  theme.corner,
                )}
              />
              <Button
                type="submit"
                className={clsx(
                  theme.buttonShape,
                  "border border-black/10 bg-white px-4 text-xs uppercase tracking-[0.24em] text-slate-700 hover:bg-black/5",
                )}
              >
                {COPY.catalogue.searchCta}
              </Button>
            </form>
          </div>
          {!filteredCards.length ? (
            <div
              className={clsx(
                "rounded-3xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-slate-600",
                theme.corner,
              )}
            >
              <p className="text-base font-semibold text-slate-900">
                {COPY.catalogue.emptyTitle}
              </p>
              <p className="mt-2">
                {COPY.catalogue.emptySubtitle}
              </p>
              <Button
                asChild
                className={clsx(
                  theme.buttonShape,
                  "mt-4 bg-[var(--site-accent)] px-5 text-white shadow-[0_25px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                )}
              >
                <a href={baseLink("/contact")}>{COPY.catalogue.emptyCta}</a>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCards.map((card) => {
                const canAddToCart = isInstantPurchase(card);
                return (
                  <div
                    key={card.id}
                    className={clsx(
                      "group flex h-full flex-col overflow-hidden border border-black/10 bg-white shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
                      theme.corner,
                    )}
                  >
                    <a href={baseLink(`/produit/${card.slug}`)}>
                      <div className="relative h-44">
                        <Image
                          src={card.image}
                          alt={card.title}
                          width={620}
                          height={360}
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                        />
                      </div>
                    </a>
                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                        <span>{card.tag}</span>
                        <span className="text-slate-900">{card.price}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {card.title}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {card.excerpt}
                      </p>
                      <div className="mt-auto flex items-center justify-between text-sm font-semibold">
                        <a
                          href={baseLink(`/produit/${card.slug}`)}
                          className="text-slate-900"
                        >
                          {COPY.catalogue.viewProduct}
                        </a>
                        {canAddToCart ? (
                          <button
                            type="button"
                            onClick={() => addItem(card)}
                            className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5"
                          >
                            {resolveCtaLabel(card.saleMode)}
                          </button>
                        ) : (
                          <a
                            href={resolveCtaHref({
                              saleMode: card.saleMode,
                              baseLink,
                              productSlug: card.slug,
                              quoteAnchor: PRODUCT_QUOTE_ANCHOR,
                            })}
                            className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5"
                          >
                            {resolveCtaLabel(card.saleMode)}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Section>
    </main>
  );
}

function ProductGallery({
  theme,
  images,
  title,
}: {
  theme: ThemeTokens;
  images: string[];
  title: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setIsZoomed(false);
  }, [images]);

  if (!images.length) return null;

  const activeImage = images[activeIndex] ?? images[0];
  const hasMultiple = images.length > 1;
  const handlePrev = () =>
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  const handleNext = () =>
    setActiveIndex((prev) => (prev + 1) % images.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
          {COPY.product.galleryLabel}
        </p>
        {hasMultiple ? (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {activeIndex + 1} / {images.length}
          </span>
        ) : null}
      </div>
      <div
        className={clsx(
          "relative overflow-hidden border border-black/10 bg-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.35)]",
          theme.corner,
        )}
      >
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="group block w-full text-left"
          aria-label={COPY.product.galleryZoom}
        >
          <div className="relative aspect-[5/4] w-full">
            <Image
              src={activeImage}
              alt={title}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover transition duration-700 group-hover:scale-[1.02]"
            />
          </div>
        </button>
        {hasMultiple ? (
          <>
            <button
              type="button"
              onClick={handlePrev}
              aria-label={COPY.product.galleryPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-lg transition hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label={COPY.product.galleryNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 shadow-lg transition hover:bg-white"
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {hasMultiple ? (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${COPY.product.galleryThumbLabel} ${index + 1}`}
              className={clsx(
                "relative h-20 w-24 shrink-0 overflow-hidden border bg-white",
                theme.corner,
                index === activeIndex
                  ? "border-[var(--site-accent)]"
                  : "border-black/10",
              )}
            >
              <Image
                src={image}
                alt={`${title} ${index + 1}`}
                fill
                sizes="96px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
      {isZoomed ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6 py-10"
          role="dialog"
          aria-modal="true"
          aria-label={COPY.product.galleryLabel}
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              className="absolute -top-12 right-0 rounded-full border border-white/40 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur hover:bg-white/20"
            >
              {COPY.product.galleryClose}
            </button>
            <div
              className={clsx(
                "relative aspect-[5/4] w-full overflow-hidden bg-black",
                theme.corner,
              )}
            >
              <Image
                src={activeImage}
                alt={title}
                fill
                sizes="90vw"
                className="object-contain"
              />
            </div>
            {hasMultiple ? (
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur hover:bg-white/20"
                >
                  {COPY.product.galleryPrev}
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-full border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur hover:bg-white/20"
                >
                  {COPY.product.galleryNext}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function UpsellSection({
  theme,
  section,
  cards,
  baseLink,
}: {
  theme: ThemeTokens;
  section?: WebsiteBuilderSection | null;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
}) {
  const { addItem } = useCart();
  const eyebrow = section?.eyebrow ?? COPY.product.upsellEyebrow;
  const title = section?.title ?? COPY.product.upsellTitle;
  const subtitle =
    section?.subtitle ?? section?.description ?? COPY.product.upsellSubtitle;

  if (!cards.length) {
    return (
      <Section theme={theme} section={section} id="upsells">
        <div
          className={clsx(
            "rounded-3xl border border-dashed border-black/15 bg-white/70 p-6 text-sm text-slate-600",
            theme.corner,
          )}
        >
          {COPY.product.upsellEmpty}
        </div>
      </Section>
    );
  }

  return (
    <Section theme={theme} section={section} id="upsells">
      <div className="flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {eyebrow}
            </p>
            <h2 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {title}
            </h2>
            <p className="text-base text-slate-600">
              {subtitle}
            </p>
          </div>
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "border border-black/10 bg-white px-5 text-sm text-slate-800 hover:bg-black/5",
            )}
            variant="ghost"
          >
            <a href={baseLink("/catalogue")}>{COPY.product.upsellViewAll}</a>
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const canAddToCart = isInstantPurchase(card);
            return (
              <div
                key={card.id}
                className={clsx(
                  "group flex h-full flex-col overflow-hidden border border-black/10 bg-white shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
                  theme.corner,
                )}
              >
                <a href={baseLink(`/produit/${card.slug}`)}>
                  <div className="relative h-40">
                    <Image
                      src={card.image}
                      alt={card.title}
                      width={640}
                      height={420}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                </a>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-500">
                    <span>{card.tag}</span>
                    <span className="text-slate-900">{card.price}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {card.excerpt}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-sm font-semibold">
                    <a
                      href={baseLink(`/produit/${card.slug}`)}
                      className="text-slate-900"
                    >
                      {COPY.catalogue.viewProduct}
                    </a>
                    {canAddToCart ? (
                      <button
                        type="button"
                        onClick={() => addItem(card)}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5"
                      >
                        {resolveCtaLabel(card.saleMode)}
                      </button>
                    ) : (
                      <a
                        href={resolveCtaHref({
                          saleMode: card.saleMode,
                          baseLink,
                          productSlug: card.slug,
                          quoteAnchor: PRODUCT_QUOTE_ANCHOR,
                        })}
                        className="rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5"
                      >
                        {resolveCtaLabel(card.saleMode)}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function ProductPage({
  theme,
  card,
  baseLink,
  currencyCode: _currencyCode,
  mode,
  path,
  slug,
  spamProtectionEnabled,
  pricingSection,
  faqSection,
  upsellSection,
  upsellCards,
}: {
  theme: ThemeTokens;
  card: CatalogCard | null;
  baseLink: (target: string) => string;
  currencyCode: string;
  mode: "public" | "preview";
  path?: string | null;
  slug: string;
  spamProtectionEnabled: boolean;
  pricingSection?: WebsiteBuilderSection | null;
  faqSection?: WebsiteBuilderSection | null;
  upsellSection?: WebsiteBuilderSection | null;
  upsellCards: CatalogCard[];
}) {
  void _currencyCode;
  const { addItem } = useCart();
  if (!card) {
    return (
      <main>
        <Section theme={theme} id="produit">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {COPY.product.notFoundEyebrow}
            </p>
            <h1 className="text-3xl font-semibold text-slate-950">
              {COPY.product.notFoundTitle}
            </h1>
            <p className="text-sm text-slate-600">
              {COPY.product.notFoundSubtitle}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                asChild
                className={clsx(
                  theme.buttonShape,
                  "bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                )}
              >
                <a href={baseLink("/catalogue")}>
                  {COPY.product.backToCatalogue}
                </a>
              </Button>
              <Button
                asChild
                variant="ghost"
                className={clsx(
                  theme.buttonShape,
                  "border border-black/10 px-6 text-slate-800 hover:bg-black/5",
                )}
              >
                <a href={baseLink("/contact")}>{COPY.product.contact}</a>
              </Button>
            </div>
          </div>
        </Section>
      </main>
    );
  }

  const current = card;
  const summary = current.excerpt || current.description;
  const details =
    current.description && current.description !== summary
      ? current.description
      : null;
  const gallery = current.gallery.length ? current.gallery : [current.image];
  const canAddToCart = isInstantPurchase(current);
  const showQuoteForm = current.saleMode === "QUOTE";
  const canRequestQuote = showQuoteForm;
  const quoteAnchor = PRODUCT_QUOTE_ANCHOR;
  const deliverables = COPY.product.deliverables;

  return (
    <main>
      <Section theme={theme} id="produit">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="space-y-6">
            <a
              href={baseLink("/catalogue")}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500"
            >
              {COPY.product.backToCatalogue}
            </a>
            <h1 className="text-4xl font-semibold text-slate-950 sm:text-5xl">
              {current.title}
            </h1>
            <p className="text-base text-slate-600">{summary}</p>
            {details ? (
              <p className="text-sm text-slate-500">{details}</p>
            ) : null}
            <div className="flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                {current.tag}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                {COPY.product.tagDuration}
              </span>
              <span className="rounded-full border border-black/10 bg-white px-3 py-1">
                {COPY.product.tagSprint}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {canAddToCart ? (
                <Button
                  type="button"
                  onClick={() => addItem(current)}
                  className={clsx(
                    theme.buttonShape,
                    "bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                  )}
                >
                  {resolveCtaLabel(current.saleMode)}
                </Button>
              ) : (
                <Button
                  asChild
                  className={clsx(
                    theme.buttonShape,
                    "bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                  )}
                >
                  <a
                    href={
                      current.saleMode === "QUOTE"
                        ? quoteAnchor
                        : resolveCtaHref({ saleMode: current.saleMode, baseLink })
                    }
                  >
                    {resolveCtaLabel(current.saleMode)}
                  </a>
                </Button>
              )}
              <span className="text-lg font-semibold text-slate-900">
                {current.price}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">
              {COPY.product.deliveryTitle}
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {deliverables.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--site-accent)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {showQuoteForm ? (
            <div
              id="demande-devis"
              className={clsx(
                "space-y-4 border border-black/10 bg-white p-6 shadow-[0_26px_60px_-45px_rgba(15,23,42,0.35)]",
                theme.corner,
              )}
            >
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">
                  {COPY.product.quoteEyebrow}
                </p>
                <h2 className="text-2xl font-semibold text-slate-950">
                  {COPY.product.quoteTitle}
                </h2>
                <p className="text-sm text-slate-600">
                  {COPY.product.quoteSubtitle}
                </p>
              </div>
              {canRequestQuote ? (
                <QuoteRequestForm
                  slug={slug}
                  mode={mode}
                  productId={current.id}
                  productName={current.title}
                  formSchema={current.quoteFormSchema}
                  spamProtectionEnabled={spamProtectionEnabled}
                  path={path}
                  className="space-y-4"
                />
              ) : (
                <p className="text-sm text-slate-600">
                  {COPY.product.quoteUnavailable}
                </p>
              )}
            </div>
          ) : null}
        </div>
        <ProductGallery theme={theme} images={gallery} title={current.title} />
      </Section>
      {pricingSection ? (
        <PricingSection theme={theme} section={pricingSection} />
      ) : null}
      {faqSection ? (
        <FaqSection theme={theme} section={faqSection} />
      ) : null}
      {upsellCards.length ? (
        <UpsellSection
          theme={theme}
          section={upsellSection}
          cards={upsellCards}
          baseLink={baseLink}
        />
      ) : null}
    </main>
  );
}

function CartPage({
  theme,
  baseLink,
  currencyCode,
  showPrices,
}: {
  theme: ThemeTokens;
  baseLink: (target: string) => string;
  currencyCode: string;
  showPrices: boolean;
}) {
  const {
    items,
    totalItems,
    totalAmountCents,
    totals,
    hasMissingPrices,
    updateItemQuantity,
    removeItem,
  } = useCart();
  const isCheckoutDisabled = !showPrices || hasMissingPrices;
  const subtotalCents =
    totals ? totals.subtotalHTCents + totals.totalDiscountCents : null;
  const subtotalLabel =
    showPrices && subtotalCents != null
      ? formatCurrency(fromCents(subtotalCents, currencyCode), currencyCode)
      : DEFAULT_PRICE_LABEL;
  const discountLabel =
    showPrices && totals
      ? `${totals.totalDiscountCents > 0 ? "- " : ""}${formatCurrency(
          fromCents(totals.totalDiscountCents, currencyCode),
          currencyCode,
        )}`
      : DEFAULT_PRICE_LABEL;
  const taxLabel =
    showPrices && totals
      ? formatCurrency(fromCents(totals.totalTVACents, currencyCode), currencyCode)
      : DEFAULT_PRICE_LABEL;
  const totalLabel =
    showPrices && totalAmountCents != null
      ? formatCurrency(fromCents(totalAmountCents, currencyCode), currencyCode)
      : DEFAULT_PRICE_LABEL;
  const checkoutMessage = !showPrices
    ? COPY.cart.pricingHidden
    : hasMissingPrices
      ? COPY.cart.missingPrice
      : null;

  if (!items.length) {
    return (
      <main>
        <Section theme={theme} id="panier">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {COPY.cart.label}
            </p>
            <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {COPY.cart.emptyTitle}
            </h1>
            <p className="text-base text-slate-600">
              {COPY.cart.emptySubtitle}
            </p>
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
              )}
            >
              <a href={baseLink("/catalogue")}>{COPY.cart.exploreCatalogue}</a>
            </Button>
          </div>
        </Section>
      </main>
    );
  }

  return (
    <main>
      <Section theme={theme} id="panier">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
                {COPY.cart.title}
              </h1>
              <span
                className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {totalItems} service{totalItems > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={clsx(
                    "flex flex-col gap-4 border border-black/10 bg-white p-4 sm:flex-row sm:items-center",
                    theme.corner,
                  )}
                >
                  <div className="relative h-20 w-24 overflow-hidden rounded-2xl">
                    <Image
                      src={item.product.image}
                      alt={item.product.title}
                      width={200}
                      height={160}
                      sizes="(max-width: 640px) 40vw, 96px"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.product.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.product.tag}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                      {COPY.cart.quantityLabel}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateItemQuantity(item.id, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-sm text-slate-700 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50"
                          aria-label="Diminuer la quantité"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateItemQuantity(item.id, item.quantity + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-sm text-slate-700 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                          aria-label="Augmenter la quantité"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {showPrices && item.product.unitAmountCents != null
                        ? formatCurrency(
                            fromCents(
                              item.product.unitAmountCents,
                              currencyCode,
                            ),
                            currencyCode,
                          )
                        : item.product.price}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:ml-auto">
                    <div className="text-sm font-semibold text-slate-900">
                      {showPrices && item.lineTotalCents != null
                        ? formatCurrency(
                            fromCents(item.lineTotalCents, currencyCode),
                            currencyCode,
                          )
                        : item.product.price}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
                    >
                      {COPY.cart.remove}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            className={clsx(
              "h-fit border border-black/10 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
              theme.corner,
            )}
          >
            <h2 className="text-xl font-semibold text-slate-900">
              {COPY.cart.summaryTitle}
            </h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>{COPY.cart.summaryServices}</span>
                <span>{totalItems}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{COPY.cart.summarySubtotal}</span>
                <span>{subtotalLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{COPY.cart.summaryDiscount}</span>
                <span>{discountLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{COPY.cart.summaryTax}</span>
                <span>{taxLabel}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-slate-900">
                <span>{COPY.cart.summaryTotal}</span>
                <span>{totalLabel}</span>
              </div>
            </div>
            {checkoutMessage ? (
              <div
                className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {checkoutMessage}
              </div>
            ) : null}
            {isCheckoutDisabled ? (
              <Button
                className={clsx(
                  theme.buttonShape,
                  "mt-6 w-full bg-[var(--site-accent)] text-white shadow-[0_26px_40px_-28px_var(--site-accent)]",
                )}
                disabled
              >
                {COPY.cart.checkout}
              </Button>
            ) : (
              <Button
                asChild
                className={clsx(
                  theme.buttonShape,
                  "mt-6 w-full bg-[var(--site-accent)] text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                )}
              >
                <a href={baseLink("/checkout")}>{COPY.cart.checkout}</a>
              </Button>
            )}
          </div>
        </div>
      </Section>
    </main>
  );
}

function CheckoutPage({
  theme,
  baseLink,
  slug,
  mode,
  path,
  currencyCode,
  showPrices,
  storageKey,
  bankTransferEnabled,
  bankTransferInstructions,
  requirePhone,
  allowNotes,
  termsUrl,
  paymentMethods,
}: {
  theme: ThemeTokens;
  baseLink: (target: string) => string;
  slug: string;
  mode: "public" | "preview";
  path?: string | null;
  currencyCode: string;
  showPrices: boolean;
  storageKey: string;
  bankTransferEnabled: boolean;
  bankTransferInstructions: string;
  requirePhone: boolean;
  allowNotes: boolean;
  termsUrl: string;
  paymentMethods: {
    card: boolean;
    bankTransfer: boolean;
    cashOnDelivery: boolean;
  };
}) {
  const {
    items,
    totalItems,
    totalAmountCents,
    totals,
    hasMissingPrices,
    clearCart,
  } = useCart();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutFieldErrors>({});
  const resolvedPath = useMemo(() => {
    if (path) return path;
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  }, [path]);
  const normalizedTermsUrl = termsUrl.trim();
  const termsHref = normalizedTermsUrl
    ? resolveLink(normalizedTermsUrl, baseLink, "/")
    : "";
  const isExternalTerms = termsHref.startsWith("http");
  const paymentMethodOptions = useMemo(
    () => {
      const methods: Array<{ id: CheckoutPaymentMethod; label: string }> = [];
      if (paymentMethods.card) {
        methods.push({ id: "card", label: COPY.checkout.paymentCard });
      }
      if (paymentMethods.bankTransfer) {
        methods.push({
          id: "bank_transfer",
          label: COPY.checkout.paymentBankTransfer,
        });
      }
      if (paymentMethods.cashOnDelivery) {
        methods.push({
          id: "cash_on_delivery",
          label: COPY.checkout.paymentCashOnDelivery,
        });
      }
      return methods;
    },
    [
      paymentMethods.bankTransfer,
      paymentMethods.card,
      paymentMethods.cashOnDelivery,
    ],
  );
  const defaultPaymentMethod = paymentMethodOptions[0]?.id ?? null;
  const pricingHidden = !showPrices;
  const subtotalCents =
    totals ? totals.subtotalHTCents + totals.totalDiscountCents : null;
  const subtotalLabel =
    showPrices && subtotalCents != null
      ? formatCurrency(fromCents(subtotalCents, currencyCode), currencyCode)
      : DEFAULT_PRICE_LABEL;
  const discountLabel =
    showPrices && totals
      ? `${totals.totalDiscountCents > 0 ? "- " : ""}${formatCurrency(
          fromCents(totals.totalDiscountCents, currencyCode),
          currencyCode,
        )}`
      : DEFAULT_PRICE_LABEL;
  const taxLabel =
    showPrices && totals
      ? formatCurrency(fromCents(totals.totalTVACents, currencyCode), currencyCode)
      : DEFAULT_PRICE_LABEL;
  const totalLabel =
    showPrices && totalAmountCents != null
      ? formatCurrency(fromCents(totalAmountCents, currencyCode), currencyCode)
      : DEFAULT_PRICE_LABEL;
  const warningMessage = pricingHidden
    ? COPY.checkout.pricingHiddenWarning
    : hasMissingPrices
      ? COPY.checkout.missingPriceWarning
      : null;
  const showPaymentMethods = paymentMethodOptions.length > 0;
  const showTerms = Boolean(normalizedTermsUrl);
  const phoneErrorId = fieldErrors.phone ? "checkout-phone-error" : undefined;
  const paymentErrorId = fieldErrors.paymentMethod
    ? "checkout-payment-error"
    : undefined;
  const termsErrorId = fieldErrors.terms ? "checkout-terms-error" : undefined;

  if (!items.length) {
    return (
      <main>
        <Section theme={theme} id="checkout">
          <div className="mx-auto max-w-3xl space-y-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {COPY.checkout.title}
            </p>
            <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
              {COPY.checkout.emptyTitle}
            </h1>
            <p className="text-base text-slate-600">
              {COPY.checkout.emptySubtitle}
            </p>
            <Button
              asChild
              className={clsx(
                theme.buttonShape,
                "bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
              )}
            >
              <a href={baseLink("/catalogue")}>{COPY.cart.exploreCatalogue}</a>
            </Button>
          </div>
        </Section>
      </main>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setFieldErrors({});

    if (pricingHidden) {
      setStatus("error");
      setError(COPY.checkout.pricingHidden);
      return;
    }

    if (hasMissingPrices) {
      setStatus("error");
      setError(
        COPY.checkout.missingPrice,
      );
      return;
    }

    const formData = new FormData(event.currentTarget);
    const normalizeField = (field: FormDataEntryValue | null) => {
      if (!field || typeof field !== "string") return null;
      const trimmed = field.trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    const customer = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      phone: normalizeField(formData.get("phone")),
      company: normalizeField(formData.get("company")),
      address: normalizeField(formData.get("address")),
    };
    const selectedPaymentMethod = formData.get("paymentMethod");
    const paymentMethod =
      typeof selectedPaymentMethod === "string"
        ? selectedPaymentMethod
        : null;
    const termsAccepted = formData.get("termsAccepted") === "true";
    const nextErrors: CheckoutFieldErrors = {};
    if (requirePhone && !customer.phone) {
      nextErrors.phone = COPY.checkout.phoneRequired;
    }
    if (normalizedTermsUrl && !termsAccepted) {
      nextErrors.terms = COPY.checkout.termsRequired;
    }
    if (paymentMethodOptions.length > 0) {
      if (!paymentMethod) {
        nextErrors.paymentMethod = COPY.checkout.paymentRequired;
      } else if (
        !paymentMethodOptions.some((option) => option.id === paymentMethod)
      ) {
        nextErrors.paymentMethod = COPY.checkout.paymentRequired;
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setStatus("error");
      setFieldErrors(nextErrors);
      setError(COPY.checkout.fieldErrors);
      return;
    }
    const notes = allowNotes ? normalizeField(formData.get("notes")) : null;
    const fallbackItems: OrderLineSummary[] = items.map((item) => ({
      id: item.id,
      title: item.product.title,
      quantity: item.quantity,
      unitAmountCents: item.product.unitAmountCents,
      lineTotalCents: item.lineTotalCents,
    }));
    const fallbackTotal = totalAmountCents ?? null;
    const fallbackReference = `CMD-${Date.now().toString(36).slice(2, 8)}`;

    if (mode === "preview") {
      console.info("[checkout] preview order confirmation", {
        slug,
        items: items.length,
      });
      writeOrderConfirmation(storageKey, {
        orderId: null,
        reference: `PREVIEW-${Date.now().toString(36).slice(2, 8)}`,
        currencyCode,
        totalAmountCents: fallbackTotal,
        items: fallbackItems,
        createdAt: new Date().toISOString(),
      });
      clearCart();
      window.location.assign(baseLink("/confirmation"));
      return;
    }

    try {
      console.info("[checkout] creating order", {
        slug,
        items: items.length,
      });
      const response = await fetch("/api/catalogue/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          customer,
          notes,
          paymentMethod:
            paymentMethodOptions.length > 0 ? paymentMethod : null,
          termsAccepted: normalizedTermsUrl ? termsAccepted : undefined,
          slug,
          mode,
          path: resolvedPath,
        }),
      });
      let result: OrderApiResponse | null = null;
      try {
        result = (await response.json()) as OrderApiResponse;
      } catch (parseError) {
        console.error("[checkout] response parse failed", parseError);
      }
      if (!response.ok || result?.error) {
        throw new Error(
          result?.error ??
            `${COPY.checkout.errorCreate} (statut ${response.status}).`,
        );
      }
      const apiItems =
        result?.order?.items?.length
          ? result.order.items.map((line) => ({
              id: line.productId,
              title: line.title,
              quantity: line.quantity,
              unitAmountCents: line.unitAmountCents,
              lineTotalCents: line.lineTotalCents,
            }))
          : fallbackItems;
      const orderId = result?.order?.id ?? null;
      const confirmationToken = result?.order?.confirmationToken ?? null;
      const confirmationParams = new URLSearchParams();
      if (orderId) {
        confirmationParams.set("orderId", orderId);
      }
      if (confirmationToken) {
        confirmationParams.set("token", confirmationToken);
      }
      const confirmationQuery = confirmationParams.toString();
      const confirmationTarget =
        !confirmationQuery
          ? baseLink("/confirmation")
          : baseLink(`/confirmation?${confirmationQuery}`);
      let checkoutUrl: string | null = null;
      if (paymentMethod === "card") {
        if (!orderId) {
          throw new Error(COPY.checkout.errorPayment);
        }
        const origin = window.location.origin;
        const successUrl = new URL(confirmationTarget, origin).toString();
        const cancelUrl = new URL(baseLink("/checkout"), origin).toString();
        const checkoutResponse = await fetch(
          "/api/catalogue/payments/checkout",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              orderId,
              method: paymentMethod,
              slug,
              mode,
              path: resolvedPath,
              successUrl,
              cancelUrl,
            }),
          },
        );
        let checkoutResult: { checkoutUrl?: string | null; error?: string } | null =
          null;
        try {
          checkoutResult = (await checkoutResponse.json()) as {
            checkoutUrl?: string | null;
            error?: string;
          };
        } catch (parseError) {
          console.error("[checkout] payment response parse failed", parseError);
        }
        if (!checkoutResponse.ok || checkoutResult?.error) {
          throw new Error(
            checkoutResult?.error ??
              `${COPY.checkout.errorPayment} (statut ${checkoutResponse.status}).`,
          );
        }
        checkoutUrl = checkoutResult?.checkoutUrl ?? null;
      }
      writeOrderConfirmation(storageKey, {
        orderId,
        reference: result?.order?.orderNumber ?? fallbackReference,
        currencyCode: result?.order?.currency ?? currencyCode,
        totalAmountCents:
          result?.order?.totalTTCCents ?? fallbackTotal,
        items: apiItems,
        createdAt: new Date().toISOString(),
      });
      clearCart();
      window.location.assign(checkoutUrl ?? confirmationTarget);
    } catch (submissionError) {
      console.error("[checkout] order creation failed", submissionError);
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : COPY.checkout.errorCreate,
      );
    }
  }

  const isLoading = status === "loading";
  const isSubmitDisabled = isLoading || hasMissingPrices || pricingHidden;
  const inputClassName =
    "mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-70";

  return (
    <main>
      <Section theme={theme} id="checkout">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)]">
          <div
            className={clsx(
              "border border-black/10 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
              theme.corner,
            )}
          >
            <h1 className="text-3xl font-semibold text-slate-950">
              {COPY.checkout.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {COPY.checkout.confirm}
            </p>
            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            ) : null}
            {warningMessage && !error ? (
              <div
                className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {warningMessage}
              </div>
            ) : null}
            <form
              className="mt-6 grid gap-4"
              onSubmit={handleSubmit}
              aria-live="polite"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="checkout-name"
                    className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                  >
                    {COPY.checkout.labelName}
                  </label>
                  <input
                    id="checkout-name"
                    name="name"
                    required
                    disabled={isLoading}
                    className={inputClassName}
                    placeholder="Amine Ben Salah"
                  />
                </div>
                <div>
                  <label
                    htmlFor="checkout-email"
                    className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                  >
                    {COPY.checkout.labelEmail}
                  </label>
                  <input
                    id="checkout-email"
                    name="email"
                    type="email"
                    required
                    disabled={isLoading}
                    className={inputClassName}
                    placeholder="amine@startup.tn"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="checkout-phone"
                    className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                  >
                    {COPY.checkout.labelPhone}
                    {requirePhone ? " *" : ""}
                  </label>
                  <input
                    id="checkout-phone"
                    name="phone"
                    required={requirePhone}
                    disabled={isLoading}
                    aria-invalid={fieldErrors.phone ? "true" : undefined}
                    aria-describedby={phoneErrorId}
                    className={inputClassName}
                    placeholder="+216 20 123 456"
                    onChange={() =>
                      setFieldErrors((current) => ({
                        ...current,
                        phone: undefined,
                      }))
                    }
                  />
                  {fieldErrors.phone ? (
                    <p
                      id={phoneErrorId}
                      className="mt-2 text-xs text-red-600"
                    >
                      {fieldErrors.phone}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor="checkout-company"
                    className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                  >
                    {COPY.checkout.labelCompany}
                  </label>
                  <input
                    id="checkout-company"
                    name="company"
                    disabled={isLoading}
                    className={inputClassName}
                    placeholder="Studio Digital"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="checkout-address"
                  className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                >
                  {COPY.checkout.labelAddress}
                </label>
                <input
                  id="checkout-address"
                  name="address"
                  disabled={isLoading}
                  className={inputClassName}
                  placeholder="10 rue Hedi Chaker, Tunis"
                />
              </div>
              {allowNotes ? (
                <div>
                  <label
                    htmlFor="checkout-notes"
                    className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                  >
                    {COPY.checkout.labelNotes}
                  </label>
                  <textarea
                    id="checkout-notes"
                    name="notes"
                    rows={4}
                    disabled={isLoading}
                    className={inputClassName}
                    placeholder={COPY.checkout.notesPlaceholder(currencyCode)}
                  />
                </div>
              ) : null}
              {showPaymentMethods ? (
                <fieldset
                  className="space-y-3"
                  aria-describedby={paymentErrorId}
                  aria-invalid={fieldErrors.paymentMethod ? "true" : undefined}
                >
                  <legend className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {COPY.checkout.paymentTitle}
                  </legend>
                  <p className="text-xs text-slate-500">
                    {COPY.checkout.paymentHint}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentMethodOptions.map((option, index) => {
                      const inputId = `checkout-payment-${option.id}`;
                      return (
                        <label
                          key={option.id}
                          htmlFor={inputId}
                          className={clsx(
                            "flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-slate-700 shadow-[0_18px_30px_-26px_rgba(15,23,42,0.2)]",
                            theme.corner,
                          )}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name="paymentMethod"
                            value={option.id}
                            defaultChecked={
                              option.id === defaultPaymentMethod ||
                              (index === 0 && !defaultPaymentMethod)
                            }
                            disabled={isLoading}
                            className="h-4 w-4 accent-[var(--site-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                            onChange={() =>
                              setFieldErrors((current) => ({
                                ...current,
                                paymentMethod: undefined,
                              }))
                            }
                          />
                          <span className="text-sm font-semibold text-slate-900">
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {fieldErrors.paymentMethod ? (
                    <p
                      id={paymentErrorId}
                      className="text-xs text-red-600"
                    >
                      {fieldErrors.paymentMethod}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}
              {showTerms ? (
                <div className="space-y-2">
                  <label
                    htmlFor="checkout-terms"
                    className="flex items-start gap-3 text-sm text-slate-600"
                  >
                    <input
                      id="checkout-terms"
                      type="checkbox"
                      name="termsAccepted"
                      value="true"
                      disabled={isLoading}
                      aria-invalid={fieldErrors.terms ? "true" : undefined}
                      aria-describedby={termsErrorId}
                      className="mt-1 h-4 w-4 accent-[var(--site-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      onChange={() =>
                        setFieldErrors((current) => ({
                          ...current,
                          terms: undefined,
                        }))
                      }
                    />
                    <span>
                      {COPY.checkout.termsLabel}{" "}
                      <a
                        href={termsHref}
                        target={isExternalTerms ? "_blank" : undefined}
                        rel={isExternalTerms ? "noreferrer noopener" : undefined}
                        className="font-semibold text-slate-900 underline underline-offset-4"
                      >
                        {COPY.checkout.termsLinkLabel}
                      </a>
                    </span>
                  </label>
                  {fieldErrors.terms ? (
                    <p
                      id={termsErrorId}
                      className="text-xs text-red-600"
                    >
                      {fieldErrors.terms}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <Button
                className={clsx(
                  theme.buttonShape,
                  "mt-2 w-full bg-[var(--site-accent)] text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                )}
                type="submit"
                disabled={isSubmitDisabled}
              >
                {isLoading ? COPY.checkout.submitLoading : COPY.checkout.submitIdle}
              </Button>
            </form>
          </div>
          <div
            className={clsx(
              "h-fit border border-black/10 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
              theme.corner,
            )}
          >
            <h2 className="text-xl font-semibold text-slate-900">
              {COPY.checkout.summaryTitle}
            </h2>
            <div className="mt-4 space-y-4 text-sm text-slate-600">
              {items.map((item) => {
                const lineLabel =
                  showPrices && item.lineTotalCents != null
                    ? formatCurrency(
                        fromCents(item.lineTotalCents, currencyCode),
                        currencyCode,
                      )
                    : item.product.price;
                return (
                  <div
                    key={`checkout-${item.id}`}
                    className="flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.product.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {COPY.checkout.quantityLabel}: {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {lineLabel}
                    </span>
                  </div>
                );
              })}
              <div className="space-y-2 border-t border-black/5 pt-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>{COPY.cart.summarySubtotal}</span>
                  <span>{subtotalLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{COPY.cart.summaryDiscount}</span>
                  <span>{discountLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{COPY.cart.summaryTax}</span>
                  <span>{taxLabel}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-900">
                  <span>{COPY.checkout.summaryTotal} ({totalItems})</span>
                  <span>{totalLabel}</span>
                </div>
              </div>
              {bankTransferEnabled ? (
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-xs text-slate-500">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {COPY.checkout.bankTransferTitle}
                  </p>
                  <p className="mt-2 whitespace-pre-line">
                    {bankTransferInstructions ||
                      COPY.checkout.bankTransferFallback}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-black/10 bg-white/70 p-4 text-xs text-slate-500">
                  {COPY.checkout.bankTransferDefault}
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}

function ConfirmationPage({
  theme,
  baseLink,
  storageKey,
  showPrices,
  currencyCode,
  bankTransferEnabled,
  bankTransferInstructions,
  mode,
  slug,
}: {
  theme: ThemeTokens;
  baseLink: (target: string) => string;
  storageKey: string;
  showPrices: boolean;
  currencyCode: string;
  bankTransferEnabled: boolean;
  bankTransferInstructions: string;
  mode: "public" | "preview";
  slug: string;
}) {
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(
    null,
  );
  const searchParams = useSearchParams();
  const confirmationOrderId = searchParams?.get("orderId") ?? "";
  const confirmationToken = searchParams?.get("token") ?? "";
  const [proofStatus, setProofStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [proofError, setProofError] = useState<string | null>(null);

  useEffect(() => {
    const stored = readOrderConfirmation(storageKey);
    if (stored) {
      setConfirmation(stored);
      return;
    }
    if (
      mode !== "public" ||
      !confirmationOrderId ||
      !confirmationToken
    ) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("token", confirmationToken);
        if (slug) {
          params.set("slug", slug);
        }
        const response = await fetch(
          `/api/catalogue/orders/${confirmationOrderId}?${params.toString()}`,
        );
        const result = (await response.json()) as OrderApiResponse;
        if (!response.ok || result?.error || !result?.order) {
          throw new Error(
            result?.error ?? COPY.confirmation.emptySummary,
          );
        }
        const apiItems: OrderLineSummary[] = result.order.items.map((line) => ({
          id: line.productId,
          title: line.title,
          quantity: line.quantity,
          unitAmountCents: line.unitAmountCents,
          lineTotalCents: line.lineTotalCents,
        }));
        const nextConfirmation: OrderConfirmation = {
          orderId: result.order.id ?? confirmationOrderId,
          reference: result.order.orderNumber ?? confirmationOrderId,
          currencyCode: result.order.currency,
          totalAmountCents: result.order.totalTTCCents,
          items: apiItems,
          createdAt: new Date().toISOString(),
        };
        if (!active) return;
        writeOrderConfirmation(storageKey, nextConfirmation);
        setConfirmation(nextConfirmation);
      } catch (summaryError) {
        console.error("[confirmation] summary fetch failed", summaryError);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    confirmationOrderId,
    confirmationToken,
    mode,
    slug,
    storageKey,
  ]);

  const resolvedCurrency = confirmation?.currencyCode ?? currencyCode;
  const totalLabel =
    showPrices && confirmation?.totalAmountCents != null
      ? formatCurrency(
          fromCents(confirmation.totalAmountCents, resolvedCurrency),
          resolvedCurrency,
        )
      : DEFAULT_PRICE_LABEL;
  const transferInstructions =
    bankTransferInstructions ||
    COPY.checkout.bankTransferFallback;
  const canUploadProof =
    bankTransferEnabled &&
    mode === "public" &&
    Boolean(confirmation?.orderId);

  async function handleProofSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!confirmation?.orderId) {
      setProofError(COPY.confirmation.proofMissingOrder);
      setProofStatus("error");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const proof = formData.get("proof");
    if (!(proof instanceof File) || proof.size === 0) {
      setProofError(COPY.confirmation.proofMissingFile);
      setProofStatus("error");
      return;
    }

    const payload = new FormData();
    payload.append("proof", proof);
    payload.append("slug", slug);
    payload.append("mode", mode);

    try {
      setProofStatus("loading");
      setProofError(null);
      const response = await fetch(
        `/api/catalogue/orders/${confirmation.orderId}/transfer-proof`,
        {
          method: "POST",
          body: payload,
        },
      );
      const result = (await response.json()) as {
        error?: string;
      };
      if (!response.ok || result.error) {
        throw new Error(
          result.error ?? COPY.confirmation.proofUploadFailed,
        );
      }
      console.info("[checkout] transfer proof uploaded", {
        orderId: confirmation.orderId,
      });
      setProofStatus("success");
      event.currentTarget.reset();
    } catch (uploadError) {
      console.error("[checkout] transfer proof failed", uploadError);
      setProofStatus("error");
      setProofError(
        uploadError instanceof Error
          ? uploadError.message
          : COPY.confirmation.proofUploadFailed,
      );
    }
  }

  return (
    <main>
      <Section theme={theme} id="confirmation">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-slate-950 sm:text-4xl">
            {COPY.confirmation.title}
          </h1>
          <p className="text-base text-slate-600">
            {COPY.confirmation.subtitle}
          </p>
          {confirmation ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-slate-600">
                {COPY.confirmation.summaryLabel}: {confirmation.reference} -{" "}
                {COPY.confirmation.summaryTotal} {totalLabel}
              </div>
              <div
                className={clsx(
                  "text-left space-y-3 border border-black/10 bg-white p-6",
                  theme.corner,
                )}
              >
                {confirmation.items.map((line) => {
                  const lineLabel =
                    showPrices && line.lineTotalCents != null
                      ? formatCurrency(
                          fromCents(
                            line.lineTotalCents,
                            resolvedCurrency,
                          ),
                          resolvedCurrency,
                        )
                      : DEFAULT_PRICE_LABEL;
                  return (
                    <div
                      key={`confirm-${line.id}`}
                      className="flex items-start justify-between gap-4 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {line.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {COPY.checkout.quantityLabel}: {line.quantity}
                        </p>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {lineLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-slate-600">
              {COPY.confirmation.emptySummary}
            </div>
          )}
          {bankTransferEnabled ? (
            <div
              className={clsx(
                "space-y-4 border border-black/10 bg-white p-6 text-left",
                theme.corner,
              )}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {COPY.confirmation.bankTransferTitle}
                </p>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">
                  {transferInstructions}
                </p>
              </div>
              {mode === "preview" ? (
                <p className="text-xs text-amber-700">
                  {COPY.confirmation.previewNote}
                </p>
              ) : canUploadProof ? (
                <form className="grid gap-3" onSubmit={handleProofSubmit}>
                  <div>
                    <label
                      htmlFor="transfer-proof"
                      className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500"
                    >
                      {COPY.confirmation.proofLabel}
                    </label>
                    <input
                      id="transfer-proof"
                      name="proof"
                      type="file"
                      required
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      disabled={proofStatus === "loading"}
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-xs text-slate-600 outline-none transition focus:border-slate-900 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-70"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={proofStatus === "loading"}
                    className={clsx(
                      theme.buttonShape,
                      "w-full bg-[var(--site-accent)] text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                    )}
                  >
                    {proofStatus === "loading"
                      ? COPY.confirmation.proofUploading
                      : COPY.confirmation.proofUpload}
                  </Button>
                  {proofStatus === "success" ? (
                    <p className="text-xs text-emerald-600">
                      {COPY.confirmation.proofSuccess}
                    </p>
                  ) : null}
                  {proofStatus === "error" && proofError ? (
                    <p className="text-xs text-red-600">{proofError}</p>
                  ) : null}
                </form>
              ) : (
                <p className="text-xs text-slate-500">
                  {COPY.confirmation.proofMissingReference}
                </p>
              )}
            </div>
          ) : null}
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "mx-auto bg-[var(--site-accent)] px-6 text-white shadow-[0_26px_40px_-28px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
            )}
          >
            <a href={baseLink("/catalogue")}>
              {COPY.confirmation.backToCatalogue}
            </a>
          </Button>
        </div>
      </Section>
    </main>
  );
}

function ContactPage({
  theme,
  company,
  mode,
  path,
  slug,
  thanksMessage,
  spamProtectionEnabled,
}: {
  theme: ThemeTokens;
  company: CatalogPayload["website"]["contact"];
  mode: "public" | "preview";
  path?: string | null;
  slug: string;
  thanksMessage: string | null;
  spamProtectionEnabled: boolean;
}) {
  return (
    <main>
      <Section theme={theme} id="contact">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.36em] text-slate-500">
              {COPY.contact.eyebrow}
            </p>
            <h1 className="text-4xl font-semibold text-slate-950 sm:text-5xl">
              {COPY.contact.title}
            </h1>
            <p className="text-base text-slate-600">
              {COPY.contact.subtitle}
            </p>
            <div className="space-y-3 text-sm text-slate-600">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {COPY.contact.labelEmail}
                </p>
                <p className="text-slate-900">
                  {company.email ?? COPY.contact.fallbackEmail}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {COPY.contact.labelPhone}
                </p>
                <p className="text-slate-900">
                  {company.phone ?? COPY.contact.fallbackPhone}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {COPY.contact.labelAddress}
                </p>
                <p className="text-slate-900">
                  {company.address ?? COPY.contact.fallbackAddress}
                </p>
              </div>
            </div>
          </div>
          <div
            className={clsx(
              "border border-black/10 bg-white p-6 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)]",
              theme.corner,
            )}
          >
            <LeadCaptureForm
              slug={slug}
              mode={mode}
              thanksMessage={thanksMessage}
              spamProtectionEnabled={spamProtectionEnabled}
              path={path}
              className="space-y-4"
            />
          </div>
        </div>
      </Section>
    </main>
  );
}

function Footer({
  theme,
  baseLink,
  company,
}: {
  theme: ThemeTokens;
  baseLink: (target: string) => string;
  company: CatalogPayload["website"]["contact"];
}) {
  const links = [
    { label: COPY.nav.home, href: baseLink("/") },
    { label: COPY.nav.catalogue, href: baseLink("/catalogue") },
    { label: COPY.nav.contact, href: baseLink("/contact") },
    { label: COPY.nav.cart, href: baseLink("/panier") },
  ];
  return (
    <footer className="border-t border-black/10 bg-white/90 py-10">
      <div
        className={clsx(
          "mx-auto flex flex-col items-center justify-between gap-6 px-6 text-center text-sm text-slate-600 sm:flex-row sm:text-left",
          theme.containerClass,
        )}
      >
        <div className="space-y-2">
          <p className="text-base font-semibold text-slate-900">
            {company.companyName}
          </p>
          <p>{COPY.footer.tagline}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="hover:text-slate-900 focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
            >
              {link.label}
            </a>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Copyright {new Date().getFullYear()} - {COPY.footer.rights}
        </p>
      </div>
    </footer>
  );
}

export function EcommerceTechAgencyTemplate({
  data,
  mode,
  path,
}: TemplateProps) {
  const builder = data.website.builder;
  const accent = builder.theme?.accent ?? data.website.accentColor ?? "#0f766e";
  const theme: ThemeTokens = {
    accent,
    accentSoft: withAlpha(accent, "1a"),
    accentStrong: withAlpha(accent, "33"),
    buttonShape: buttonShapeMap[builder.theme?.buttonShape ?? "rounded"],
    corner: cornerMap[builder.theme?.cornerStyle ?? "rounded"],
    containerClass: containerMap[builder.theme?.containerWidth ?? "default"],
    sectionSpacing: spacingMap[builder.theme?.sectionSpacing ?? "comfortable"],
  };
  const inlineStyles = {
    "--site-accent": theme.accent,
    "--site-accent-soft": theme.accentSoft,
    "--site-accent-strong": theme.accentStrong,
    "--site-bg": "#f8fafc",
    "--site-surface": "#ffffff",
    "--site-ink": "#0f172a",
    "--site-muted": "#475569",
    fontFamily: '"Space Grotesk","Sora","Manrope","Segoe UI",sans-serif',
  } as CSSProperties;
  const ecommerceSettings = data.website.ecommerceSettings;
  const paymentMethods = {
    card: ecommerceSettings?.payments?.methods?.card ?? false,
    bankTransfer: ecommerceSettings?.payments?.methods?.bankTransfer ?? false,
    cashOnDelivery:
      ecommerceSettings?.payments?.methods?.cashOnDelivery ?? false,
  };
  const checkoutSettings = ecommerceSettings?.checkout;
  const bankTransferEnabled = paymentMethods.bankTransfer;
  const bankTransferInstructions =
    ecommerceSettings?.payments?.bankTransfer?.instructions?.trim() ?? "";
  const requirePhone = checkoutSettings?.requirePhone ?? false;
  const allowNotes = checkoutSettings?.allowNotes ?? true;
  const termsUrl = checkoutSettings?.termsUrl ?? "";
  const currencyCode = data.website.currencyCode ?? "TND";
  const mediaLibrary = builder.mediaLibrary ?? [];

  const sections = builder.sections.filter((section) => section.visible !== false);
  const heroSection = resolveSection(sections, "hero", ["content"]);
  const servicesSection = resolveSection(sections, "services", ["products", "categories"]);
  const logosSection = resolveSection(sections, "logos");
  const aboutSection = resolveSection(sections, "about");
  const gallerySection = resolveSection(sections, "gallery");
  const pricingSection = resolveSection(sections, "pricing");
  const faqSection = resolveSection(sections, "faq");
  const proofSection = resolveSection(sections, "testimonials");
  const ctaSection = resolveSection(sections, "promo", ["newsletter", "contact"]);
  const page = resolvePage(path);
  const baseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${data.website.slug}${normalizePath(target)}`;

  const allCards = useMemo(
    () =>
      buildServiceCards({
        products: data.products.all,
        currencyCode,
        showPrices: data.website.showPrices,
      }),
    [
      data.products.all,
      currencyCode,
      data.website.showPrices,
    ],
  );
  const featuredCards = useMemo(
    () =>
      buildServiceCards({
        products: data.products.featured,
        currencyCode,
        showPrices: data.website.showPrices,
      }),
    [
      data.products.featured,
      currencyCode,
      data.website.showPrices,
    ],
  );
  const hasFeaturedSelection =
    (data.website.ecommerceSettings?.featuredProductIds?.length ?? 0) > 0;
  const homeCards = useMemo(
    () => {
      const sourceCards = hasFeaturedSelection ? featuredCards : allCards;
      return sourceCards.length > 6
        ? sourceCards.slice(0, 6)
        : sourceCards;
    },
    [allCards, featuredCards, hasFeaturedSelection],
  );
  const proofCards = useMemo(
    () => buildProofCards(proofSection),
    [proofSection],
  );
  const metrics = useMemo(() => buildMetrics(), []);
  const productCard = useMemo(() => {
    if (page.page !== "product") return null;
    return allCards.find((card) => card.slug === page.productSlug) ?? null;
  }, [page, allCards]);
  const upsellCards = useMemo(() => {
    if (!featuredCards.length) return [];
    if (!productCard) return featuredCards;
    return featuredCards.filter((card) => card.id !== productCard.id);
  }, [featuredCards, productCard]);
  const cartStorageKey = `catalog-cart:${data.website.id}`;
  const confirmationStorageKey = buildOrderStorageKey(data.website.id);

  return (
    <CartProvider storageKey={cartStorageKey} catalog={allCards}>
      <div
        className="relative min-h-screen bg-[var(--site-bg)] text-[var(--site-ink)]"
        style={inlineStyles}
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[var(--site-accent-soft)] blur-3xl animate-[float_16s_ease-in-out_infinite]" />
          <div className="absolute right-[-10%] top-0 h-[420px] w-[420px] rounded-full bg-[var(--site-accent-soft)] blur-3xl animate-[float_20s_ease-in-out_infinite] [animation-delay:2s]" />
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(120deg, rgba(15, 23, 42, 0.06) 1px, transparent 1px), linear-gradient(35deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
        </div>
        {mode === "preview" ? (
          <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
            {COPY.misc.previewBanner}
          </div>
        ) : null}
        <Navbar
          theme={theme}
          baseLink={baseLink}
          company={data.website.contact}
        />
        {page.page === "home" ? (
          <>
            {heroSection ? (
              <HeroSection
                theme={theme}
                section={heroSection}
                baseLink={baseLink}
                company={data.website.contact}
                mediaLibrary={mediaLibrary}
              />
            ) : null}
            {logosSection ? (
              <LogosSection
                theme={theme}
                section={logosSection}
                mediaLibrary={mediaLibrary}
              />
            ) : null}
            {servicesSection ? (
              <ServicesSection
                theme={theme}
                section={servicesSection}
                cards={homeCards}
                baseLink={baseLink}
              />
            ) : null}
            {aboutSection ? (
              <AboutSection
                theme={theme}
                section={aboutSection}
                mediaLibrary={mediaLibrary}
              />
            ) : null}
            {gallerySection ? (
              <GallerySection
                theme={theme}
                section={gallerySection}
                mediaLibrary={mediaLibrary}
              />
            ) : null}
            {pricingSection ? (
              <PricingSection theme={theme} section={pricingSection} />
            ) : null}
            {proofSection ? (
              <ProofSection
                theme={theme}
                section={proofSection}
                proofs={proofCards}
                metrics={metrics}
              />
            ) : null}
            {faqSection ? (
              <FaqSection theme={theme} section={faqSection} />
            ) : null}
            {ctaSection ? (
              <CtaSection theme={theme} section={ctaSection} baseLink={baseLink} />
            ) : null}
          </>
        ) : null}
        {page.page === "catalogue" ? (
          <CataloguePage
            theme={theme}
            cards={allCards}
            baseLink={baseLink}
            categorySlug={page.categorySlug ?? null}
          />
        ) : null}
        {page.page === "product" ? (
          <ProductPage
            theme={theme}
            card={productCard}
            baseLink={baseLink}
            currencyCode={currencyCode}
            mode={mode}
            path={path}
            slug={data.website.slug}
            spamProtectionEnabled={data.website.spamProtectionEnabled}
            pricingSection={pricingSection}
            faqSection={faqSection}
            upsellSection={servicesSection}
            upsellCards={upsellCards}
          />
        ) : null}
        {page.page === "cart" ? (
          <CartPage
            theme={theme}
            baseLink={baseLink}
            currencyCode={currencyCode}
            showPrices={data.website.showPrices}
          />
        ) : null}
      {page.page === "checkout" ? (
        <CheckoutPage
          theme={theme}
          baseLink={baseLink}
          slug={data.website.slug}
          mode={mode}
          path={path}
          currencyCode={currencyCode}
          showPrices={data.website.showPrices}
          storageKey={confirmationStorageKey}
          bankTransferEnabled={bankTransferEnabled}
          bankTransferInstructions={bankTransferInstructions}
          requirePhone={requirePhone}
          allowNotes={allowNotes}
          termsUrl={termsUrl}
          paymentMethods={paymentMethods}
        />
      ) : null}
      {page.page === "confirmation" ? (
        <ConfirmationPage
          theme={theme}
          baseLink={baseLink}
          storageKey={confirmationStorageKey}
          showPrices={data.website.showPrices}
          currencyCode={currencyCode}
          bankTransferEnabled={bankTransferEnabled}
          bankTransferInstructions={bankTransferInstructions}
          mode={mode}
          slug={data.website.slug}
        />
      ) : null}
        {page.page === "contact" ? (
          <ContactPage
            theme={theme}
            company={data.website.contact}
            mode={mode}
            path={path}
            slug={data.website.slug}
            thanksMessage={data.website.leadThanksMessage ?? null}
            spamProtectionEnabled={data.website.spamProtectionEnabled}
          />
        ) : null}
        <Footer theme={theme} baseLink={baseLink} company={data.website.contact} />
        <style jsx>{`
          @keyframes float {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-18px);
            }
          }
          @keyframes reveal {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes marquee {
            from {
              transform: translateX(0);
            }
            to {
              transform: translateX(-50%);
            }
          }
        `}</style>
      </div>
    </CartProvider>
  );
}
