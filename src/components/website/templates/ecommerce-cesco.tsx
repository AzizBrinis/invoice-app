"use client";

import clsx from "clsx";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
type CatalogProduct = CatalogPayload["products"]["all"][number];

type CheckoutPaymentMethod = "card" | "bank_transfer" | "cash_on_delivery";

type CatalogCard = CartProduct & {
  excerpt: string;
  productExcerpt?: string | null;
  description: string;
  shortDescriptionHtml?: string | null;
  gallery: string[];
  quoteFormSchema: unknown | null;
  category: string | null;
  categorySlug: string | null;
  badge?: string | null;
  rating?: number;
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

type DiscoveryCard = {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
  cta: string;
};

type PromoBlock = {
  id: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  image: string;
  tone: "mint" | "sun" | "sky";
};

type CategoryTile = {
  id: string;
  title: string;
  description: string;
  image: string;
  href: string;
};

type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  href: string;
  tag: string;
  date: string;
};

type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  rating: number;
};

type FeatureItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: "truck" | "spark" | "shield" | "gift";
};

type DepartmentItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: "women" | "men" | "kids" | "home";
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
    cta: "Découvrir",
  },
  hero: {
    title: "Collection exclusive pour tous",
    subtitle:
      "Mode, maison et cadeaux sélectionnés pour un shopping simple en Tunisie.",
    eyebrow: "E-commerce Cesco",
    secondaryCta: "Voir les nouveautés",
    badges: ["Nouveautés", "Paiement sécurisé", "Retours faciles"],
    locationFallback: "Tunis, Tunisie",
    previewAlt: "Aperçu héro",
    roadmapLabel: "Livraison express",
    roadmapMetric: "48h partout en Tunisie",
    roadmapTag: "Rapide",
  },
  home: {
    discoveryEyebrow: "Découvrir",
    discoveryTitle: "Découvrez plus, de bonnes choses vous attendent",
    discoverySubtitle:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor.",
    discoveryCta: "Voir la sélection",
    newArrivalsEyebrow: "Nouveautés",
    newArrivalsTitle: "Arrivages récents",
    newArrivalsSubtitle:
      "Des pièces fraîches et faciles à porter au quotidien.",
    featuresEyebrow: "Pourquoi Cesco",
    featuresTitle: "Une expérience d'achat sereine",
    promoEyebrow: "Cesco Rewards",
    promoTitle: "Gagnez plus avec Cesco",
    promoSubtitle:
      "Cumulez des points, recevez des avantages et profitez de nos offres locales.",
    promoCta: "Commencer",
    exploreEyebrow: "Explorer",
    exploreTitle: "Commencer à explorer",
    exploreSubtitle:
      "Parcourez nos univers favoris et trouvez votre prochain coup de cœur.",
    bestSellersEyebrow: "Best-sellers",
    bestSellersTitle: "Meilleures ventes du mois",
    bestSellersSubtitle: "Les incontournables choisis par notre communauté.",
    specialOfferEyebrow: "Offre spéciale",
    specialOfferTitle: "Offres kids à ne pas manquer",
    specialOfferSubtitle:
      "Des essentiels confortables pour enfants, disponibles en quantités limitées.",
    specialOfferCta: "Découvrir",
    categoryShowcaseEyebrow: "Catégories",
    categoryShowcaseTitle: "Explorer par catégories",
    categoryShowcaseSubtitle: "Des sélections rapides pour chaque envie.",
    favoritesEyebrow: "Favoris",
    favoritesTitle: "Trouvez vos produits favoris",
    favoritesSubtitle: "Filtrez par univers et repérez les pièces tendances.",
    favoritesAll: "Tout",
    departmentsEyebrow: "Départements",
    departmentsTitle: "Acheter par département",
    departmentsSubtitle: "Mode, maison, cadeaux et bien plus.",
    blogEyebrow: "Actualités",
    blogTitle: "Les dernières nouvelles",
    blogSubtitle: "Depuis le blog Cesco",
    testimonialsEyebrow: "Avis clients",
    testimonialsTitle: "Ils parlent de Cesco",
    testimonialsSubtitle: "Retours vérifiés en Tunisie",
  },
  services: {
    eyebrow: "Découverte",
    title: "Sélections du moment",
    subtitle:
      "Des cartes rapides pour parcourir nos univers phares.",
    emptyTitle: "Sélection en préparation.",
    emptySubtitle:
      "Revenez vite pour découvrir nos nouvelles collections.",
    emptyCta: "Nous contacter",
    viewAll: "Voir tout",
    viewDetail: "Voir le détail",
  },
  proof: {
    eyebrow: "Avis",
    title: "Ils reviennent pour nos collections",
    subtitle:
      "Des témoignages clients pour rassurer vos visiteurs.",
    defaultCards: [
      {
        id: "proof-1",
        quote:
          "Livraison rapide et produits conformes, tout était parfait.",
        name: "Sarra M.",
        role: "Cliente fidèle",
      },
      {
        id: "proof-2",
        quote:
          "Service client réactif et emballage soigné. Merci Cesco !",
        name: "Hichem B.",
        role: "Acheteur en ligne",
      },
      {
        id: "proof-3",
        quote:
          "Les tailles sont justes et la qualité est au rendez-vous.",
        name: "Inès R.",
        role: "Cliente",
      },
    ],
  },
  logos: {
    eyebrow: "Avantages",
    title: "Des services qui simplifient vos achats",
    subtitle: "Paiement local, livraison rapide et support dédié.",
    empty: "Ajoutez des éléments pour valoriser vos avantages.",
  },
  about: {
    eyebrow: "À propos",
    title: "Un univers pensé pour toute la famille",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec vitae.",
    empty: "Ajoutez vos valeurs et votre histoire de marque.",
  },
  gallery: {
    eyebrow: "Blog",
    title: "Journal Cesco",
    subtitle: "Conseils d'achat, inspirations et nouveautés locales.",
    empty: "Ajoutez des articles ou inspirations.",
  },
  pricing: {
    eyebrow: "Offres",
    title: "Promos et bundles",
    subtitle: "Des offres modulables et transparentes.",
    empty: "Ajoutez vos promos et bundles.",
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions fréquentes",
    subtitle: "Transparence sur nos délais, livraisons et retours.",
    empty: "Ajoutez vos questions clés.",
  },
  metrics: [
    { label: "Livraison", value: "48h" },
    { label: "Articles", value: "1 200+" },
    { label: "Avis", value: "4,8/5" },
  ],
  cta: {
    eyebrow: "Newsletter",
    title: "Recevez nos nouveautés en avant-première",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    tags: ["Nouveautés", "Promos", "Conseils"],
    primary: "S'inscrire",
    secondary: "Explorer le catalogue",
  },
  catalogue: {
    eyebrow: "Catalogue",
    title: "Découvrez nos produits du moment",
    subtitle:
      "Mode, accessoires et maison soigneusement sélectionnés.",
    filterAll: "Tous",
    searchLabel: "Rechercher dans le catalogue",
    searchPlaceholder: "Rechercher un produit",
    searchCta: "Rechercher",
    emptyTitle: "Aucun produit disponible pour le moment.",
    emptySubtitle:
      "Revenez bientôt ou contactez-nous pour une demande spécifique.",
    emptyCta: "Contacter Cesco",
    viewProduct: "Voir la fiche",
  },
  product: {
    notFoundEyebrow: "Produit indisponible",
    notFoundTitle: "Ce produit n'existe pas ou n'est plus disponible.",
    notFoundSubtitle:
      "Consultez le catalogue ou contactez-nous pour une alternative.",
    backToCatalogue: "Retour au catalogue",
    contact: "Nous contacter",
    galleryLabel: "Galerie du produit",
    galleryZoom: "Agrandir l'image",
    galleryClose: "Fermer l'aperçu",
    galleryPrev: "Image précédente",
    galleryNext: "Image suivante",
    galleryThumbLabel: "Aperçu",
    deliveryTitle: "Détails & livraison",
    deliverables: [
      "Livraison rapide en Tunisie",
      "Retours faciles sous 14 jours",
      "Paiement sécurisé",
      "Support client local",
    ],
    upsellEyebrow: "Produits complémentaires",
    upsellTitle: "Complétez votre sélection",
    upsellSubtitle:
      "Ajoutez un produit connexe pour finaliser votre panier.",
    upsellEmpty:
      "Ajoutez des produits en vedette pour enrichir cette section.",
    upsellViewAll: "Voir tout le catalogue",
    quoteEyebrow: "Demande de devis",
    quoteTitle: "Parlons de votre besoin",
    quoteSubtitle: "Décrivez votre demande, nous vous répondons sous 24 h.",
    quoteUnavailable: "Le formulaire de devis n'est pas disponible pour ce produit.",
    tagDuration: "Livraison rapide",
    tagSprint: "Nouvelle collection",
  },
  cart: {
    label: "Panier",
    emptyTitle: "Votre panier est vide",
    emptySubtitle: "Ajoutez un produit pour démarrer vos achats.",
    exploreCatalogue: "Explorer le catalogue",
    title: "Votre panier",
    quantityLabel: "Quantité",
    remove: "Retirer",
    summaryTitle: "Résumé",
    summaryServices: "Produits",
    summarySubtotal: "Sous-total HT",
    summaryDiscount: "Remise",
    summaryTax: "TVA",
    summaryTotal: "Total TTC",
    checkout: "Passer au paiement",
    pricingHidden:
      "Les tarifs sont masqués pour ce site. Contactez-nous pour finaliser votre commande.",
    missingPrice:
      "Certains produits n'ont pas de prix. Contactez-nous pour finaliser votre commande.",
  },
  checkout: {
    title: "Finaliser la commande",
    emptyTitle: "Panier vide",
    emptySubtitle: "Ajoutez un produit pour passer au paiement.",
    missingPrice: "Certains produits n'ont pas de prix. Contactez-nous pour finaliser la commande.",
    missingPriceWarning:
      "Certains produits n'ont pas de prix. Merci de nous contacter pour finaliser la commande.",
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
      `Ajoutez une note ou un détail de livraison (${currencyCode}).`,
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
      "Merci. Votre commande est enregistrée, nous revenons vite vers vous.",
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
    title: "Parlez-nous de votre besoin",
    subtitle:
      "Une question sur une commande ou un produit ? Notre équipe répond vite.",
    labelEmail: "Email",
    labelPhone: "Téléphone",
    labelAddress: "Adresse",
    fallbackEmail: "contact@cesco.tn",
    fallbackPhone: "+216 71 000 000",
    fallbackAddress: "Tunis, Tunisie",
  },
  footer: {
    tagline: "Mode, maison et cadeaux pour toute la famille.",
    rights: "Tous droits réservés",
    newsletterTitle: "Newsletter",
    newsletterSubtitle: "Recevez nos nouveautés et offres exclusives.",
    newsletterLabel: "Adresse e-mail",
    newsletterPlaceholder: "email@exemple.com",
    newsletterCta: "S'abonner",
  },
  misc: {
    previewBanner: "Mode prévisualisation — les liens internes utilisent ?path=",
    serviceExcerpt: "Produit tendance sélectionné par Cesco.",
    proofQuoteFallback: "Avis client à personnaliser.",
    proofRoleFallback: "Client Cesco",
  },
} as const;

// NOTE: Ajustez les images/texte Cesco ici ou via le builder avancé du module Site Web.
const createPreviewGallery = () => [...WEBSITE_MEDIA_PLACEHOLDERS.gallery];
const PREVIEW_PRODUCT_DEFAULTS = {
  descriptionHtml: null,
  metaTitle: null,
  metaDescription: null,
  optionConfig: null,
  variantStock: null,
  stockQuantity: null,
} satisfies Pick<
  CatalogProduct,
  | "descriptionHtml"
  | "metaTitle"
  | "metaDescription"
  | "optionConfig"
  | "variantStock"
  | "stockQuantity"
>;

const PREVIEW_PRODUCTS: CatalogProduct[] = [
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-chemise-atlas",
    name: "Chemise Atlas",
    description: "Chemise légère avec coupe moderne et col structuré.",
    excerpt: "Un essentiel facile à assortir.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[0],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Homme",
    unit: "pièce",
    priceHTCents: 42000,
    priceTTCCents: 49980,
    vatRate: 19,
    defaultDiscountRate: 10,
    sku: "CHE-ATLAS",
    publicSlug: "chemise-atlas",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-blouse-nora",
    name: "Blouse Nora",
    description: "Blouse fluide et confortable pour toutes les saisons.",
    excerpt: "Un basique revisité.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[1],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Femme",
    unit: "pièce",
    priceHTCents: 52000,
    priceTTCCents: 61880,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "BLO-NORA",
    publicSlug: "blouse-nora",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-sac-zephyr",
    name: "Sac Zéphyr",
    description: "Sac cabas avec finitions tressées et anse réglable.",
    excerpt: "Parfait pour la ville.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[2],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Accessoires",
    unit: "pièce",
    priceHTCents: 35000,
    priceTTCCents: 41650,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "SAC-ZEPHYR",
    publicSlug: "sac-zephyr",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-sweat-junior",
    name: "Sweat Junior",
    description: "Sweat doux et chaud pour les journées actives.",
    excerpt: "Confort garanti.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[0],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Kids",
    unit: "pièce",
    priceHTCents: 28000,
    priceTTCCents: 33320,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "SWE-JUNIOR",
    publicSlug: "sweat-junior",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-pack-deco",
    name: "Pack déco Maison",
    description: "Pack d'accessoires déco personnalisé.",
    excerpt: "Un set sur-mesure pour votre intérieur.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[1],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Maison",
    unit: "pack",
    priceHTCents: 110000,
    priceTTCCents: 130900,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "PACK-DECO",
    publicSlug: "pack-deco-maison",
    saleMode: "QUOTE",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-parfum-naya",
    name: "Parfum Naya",
    description: "Notes florales et musquées, tenue longue durée.",
    excerpt: "Une signature délicate.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[2],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Beauté",
    unit: "pièce",
    priceHTCents: 60000,
    priceTTCCents: 71400,
    vatRate: 19,
    defaultDiscountRate: 5,
    sku: "PAR-NAYA",
    publicSlug: "parfum-naya",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-sandales-sable",
    name: "Sandales Sable",
    description: "Sandales légères avec semelle confort.",
    excerpt: "Pour l'été tunisien.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[0],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Femme",
    unit: "paire",
    priceHTCents: 48000,
    priceTTCCents: 57120,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "SAN-SABLE",
    publicSlug: "sandales-sable",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-veste-denim",
    name: "Veste Denim",
    description: "Veste en jean robuste avec coupe droite.",
    excerpt: "Un intemporel revisité.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[1],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Homme",
    unit: "pièce",
    priceHTCents: 65000,
    priceTTCCents: 77350,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "VES-DENIM",
    publicSlug: "veste-denim",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-casquette-urban",
    name: "Casquette Urban",
    description: "Casquette ajustable avec broderie ton sur ton.",
    excerpt: "Détail streetwear.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[2],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Accessoires",
    unit: "pièce",
    priceHTCents: 22000,
    priceTTCCents: 26180,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "CAS-URBAN",
    publicSlug: "casquette-urban",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-pack-cadeau",
    name: "Pack cadeau",
    description: "Pack personnalisable pour toutes les occasions.",
    excerpt: "Un cadeau clé en main.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[1],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Cadeaux",
    unit: "pack",
    priceHTCents: 90000,
    priceTTCCents: 107100,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "PACK-GIFT",
    publicSlug: "pack-cadeau",
    saleMode: "QUOTE",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-tshirt-breeze",
    name: "T-shirt Breeze",
    description: "T-shirt respirant, coupe relax.",
    excerpt: "Le basique du quotidien.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[0],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Homme",
    unit: "pièce",
    priceHTCents: 30000,
    priceTTCCents: 35700,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "TSH-BREEZE",
    publicSlug: "tshirt-breeze",
    saleMode: "INSTANT",
    isActive: true,
  },
  {
    ...PREVIEW_PRODUCT_DEFAULTS,
    id: "preview-robe-lina",
    name: "Robe Lina",
    description: "Robe fluide idéale pour les journées ensoleillées.",
    excerpt: "Élégance simple.",
    coverImageUrl: WEBSITE_MEDIA_PLACEHOLDERS.gallery[2],
    gallery: createPreviewGallery(),
    quoteFormSchema: null,
    category: "Femme",
    unit: "pièce",
    priceHTCents: 54000,
    priceTTCCents: 64260,
    vatRate: 19,
    defaultDiscountRate: null,
    sku: "ROB-LINA",
    publicSlug: "robe-lina",
    saleMode: "INSTANT",
    isActive: true,
  },
];

const PREVIEW_DISCOVERY: DiscoveryCard[] = [
  {
    id: "discover-1",
    title: "Accessoires en vedette",
    description: "Des pièces faciles à associer chaque jour.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.products[0],
    href: "/catalogue",
    cta: COPY.home.discoveryCta,
  },
  {
    id: "discover-2",
    title: "Sneakers & street",
    description: "Le confort urbain dans des tons modernes.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.products[1],
    href: "/catalogue",
    cta: COPY.home.discoveryCta,
  },
  {
    id: "discover-3",
    title: "Beauté & senteurs",
    description: "Nouveaux rituels et coffrets locaux.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.products[2],
    href: "/catalogue",
    cta: COPY.home.discoveryCta,
  },
];

const PREVIEW_PROMOS: PromoBlock[] = [
  {
    id: "promo-1",
    title: COPY.home.promoTitle,
    description: COPY.home.promoSubtitle,
    cta: COPY.home.promoCta,
    href: "/catalogue",
    image: WEBSITE_MEDIA_PLACEHOLDERS.promos[0],
    tone: "mint",
  },
  {
    id: "promo-2",
    title: COPY.home.specialOfferTitle,
    description: COPY.home.specialOfferSubtitle,
    cta: COPY.home.specialOfferCta,
    href: "/catalogue",
    image: WEBSITE_MEDIA_PLACEHOLDERS.promos[1],
    tone: "sun",
  },
];

const PREVIEW_CATEGORIES: CategoryTile[] = [
  {
    id: "cat-femme",
    title: "Femme",
    description: "Silhouettes du quotidien",
    image: WEBSITE_MEDIA_PLACEHOLDERS.categories[0],
    href: "/categories/femme",
  },
  {
    id: "cat-homme",
    title: "Homme",
    description: "Essentiels & casual",
    image: WEBSITE_MEDIA_PLACEHOLDERS.categories[1],
    href: "/categories/homme",
  },
  {
    id: "cat-kids",
    title: "Kids",
    description: "Confort et couleurs",
    image: WEBSITE_MEDIA_PLACEHOLDERS.categories[2],
    href: "/categories/kids",
  },
  {
    id: "cat-maison",
    title: "Maison",
    description: "Objets et déco",
    image: WEBSITE_MEDIA_PLACEHOLDERS.categories[1],
    href: "/categories/maison",
  },
  {
    id: "cat-beaute",
    title: "Beauté",
    description: "Rituels & parfums",
    image: WEBSITE_MEDIA_PLACEHOLDERS.categories[0],
    href: "/categories/beaute",
  },
  {
    id: "cat-cadeaux",
    title: "Cadeaux",
    description: "Sélections rapides",
    image: WEBSITE_MEDIA_PLACEHOLDERS.categories[2],
    href: "/categories/cadeaux",
  },
];

const PREVIEW_BLOG_POSTS: BlogPost[] = [
  {
    id: "post-1",
    title: "Nos essentiels du printemps 2024",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.gallery[0],
    href: "/catalogue",
    tag: "Sélections",
    date: "12 avril 2024",
  },
  {
    id: "post-2",
    title: "Comment choisir ses baskets au quotidien",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.gallery[1],
    href: "/catalogue",
    tag: "Guide",
    date: "08 avril 2024",
  },
  {
    id: "post-3",
    title: "Maison: les tons doux qui réchauffent",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.gallery[2],
    href: "/catalogue",
    tag: "Décoration",
    date: "02 avril 2024",
  },
  {
    id: "post-4",
    title: "Nos idées cadeaux locales",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image: WEBSITE_MEDIA_PLACEHOLDERS.gallery[0],
    href: "/catalogue",
    tag: "Cadeaux",
    date: "28 mars 2024",
  },
];

const PREVIEW_TESTIMONIALS: Testimonial[] = [
  {
    id: "testi-1",
    quote: "Qualité au top et livraison rapide. Je recommande.",
    name: "Amira",
    role: "Cliente Cesco",
    rating: 5,
  },
  {
    id: "testi-2",
    quote: "Beaucoup de choix et prix raisonnables.",
    name: "Youssef",
    role: "Acheteur régulier",
    rating: 4.8,
  },
  {
    id: "testi-3",
    quote: "Le service client est très réactif.",
    name: "Rania",
    role: "Cliente",
    rating: 4.7,
  },
];

const FEATURE_ITEMS: FeatureItem[] = [
  {
    id: "feature-delivery",
    title: "Livraison rapide",
    subtitle: "48h partout en Tunisie",
    icon: "truck",
  },
  {
    id: "feature-quality",
    title: "Qualité garantie",
    subtitle: "Sélection locale et internationale",
    icon: "spark",
  },
  {
    id: "feature-secure",
    title: "Paiement sécurisé",
    subtitle: "Carte, virement, paiement à la livraison",
    icon: "shield",
  },
  {
    id: "feature-support",
    title: "Support dédié",
    subtitle: "Assistance 7j/7",
    icon: "gift",
  },
];

const DEPARTMENT_ITEMS: DepartmentItem[] = [
  {
    id: "dept-women",
    title: "Femme",
    subtitle: "Looks quotidiens",
    icon: "women",
  },
  {
    id: "dept-men",
    title: "Homme",
    subtitle: "Essentiels & casual",
    icon: "men",
  },
  {
    id: "dept-kids",
    title: "Kids",
    subtitle: "Confort & couleurs",
    icon: "kids",
  },
  {
    id: "dept-home",
    title: "Maison",
    subtitle: "Objets utiles",
    icon: "home",
  },
];

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
  amountCents?: number | null;
  currencyCode?: string;
  label?: string | null;
}) {
  if (options.saleMode === "QUOTE" || !options.showPrices) {
    return DEFAULT_PRICE_LABEL;
  }
  if (options.amountCents != null && options.currencyCode) {
    return formatCurrency(
      fromCents(options.amountCents, options.currencyCode),
      options.currencyCode,
    );
  }
  return options.label ?? DEFAULT_PRICE_LABEL;
}

function resolveUnitAmountCents(options: {
  saleMode: SaleMode;
  priceTTCCents: number | null;
  priceHTCents: number | null;
  vatRate: number | null;
  discountRate?: number | null;
  discountAmountCents?: number | null;
}) {
  return computeAdjustedUnitPriceTTCCents({
    saleMode: options.saleMode,
    priceTTCCents: options.priceTTCCents,
    priceHTCents: options.priceHTCents,
    vatRate: options.vatRate,
    discountRate: options.discountRate ?? null,
    discountAmountCents: options.discountAmountCents ?? null,
  });
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

function isInstantPurchase(
  card: Pick<CartProduct, "saleMode" | "unitPriceHTCents" | "vatRate">,
) {
  return (
    card.saleMode === "INSTANT" &&
    card.unitPriceHTCents != null &&
    card.vatRate != null
  );
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

const externalProtocolPattern = /^[a-z][a-z0-9+.-]*:/i;

function resolveLink(
  href: string | null | undefined,
  baseLink: (target: string) => string,
  fallback: string,
) {
  if (!href) return baseLink(fallback);
  if (href.startsWith("#")) return href;
  if (externalProtocolPattern.test(href)) return href;
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
    const productExcerpt = product.excerpt?.trim() || null;
    const excerpt = productExcerpt ?? COPY.misc.serviceExcerpt;
    const unitPriceHTCents =
      product.saleMode === "INSTANT" ? product.priceHTCents : null;
    const vatRate = product.saleMode === "INSTANT" ? product.vatRate : null;
    const discount = resolveProductDiscount(product);
    const unitAmountCents = resolveUnitAmountCents({
      saleMode: product.saleMode,
      priceTTCCents: product.priceTTCCents ?? null,
      priceHTCents: unitPriceHTCents,
      vatRate,
      discountRate: discount.discountRate,
      discountAmountCents: discount.discountAmountCents,
    });
    const category = product.category?.trim() ?? null;
    const categorySlug = category ? slugify(category) || null : null;
    const rating = Math.max(4.2, 4.9 - index * 0.08);
    return {
      id: product.id,
      title: product.name,
      excerpt,
      productExcerpt,
      description: product.description ?? "",
      shortDescriptionHtml: product.shortDescriptionHtml ?? null,
      tag: category ?? "Collection",
      category,
      categorySlug,
      badge: index < 2 ? "Nouveau" : null,
      rating: Number(rating.toFixed(1)),
      price: resolvePriceLabel({
        saleMode: product.saleMode,
        showPrices: options.showPrices,
        amountCents: unitAmountCents,
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

function buildDiscoveryCards(options: {
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  baseLink: (target: string) => string;
}): DiscoveryCard[] {
  const items = options.section?.items?.length ? options.section.items : [];
  if (!items.length) {
    return PREVIEW_DISCOVERY.map((card) => ({
      ...card,
      href: resolveLink(card.href, options.baseLink, "/catalogue"),
    }));
  }
  return items.slice(0, 3).map((item, index) => ({
    id: item.id,
    title: item.title ?? `Découverte ${index + 1}`,
    description:
      item.description ??
      COPY.home.discoverySubtitle,
    image: resolveMedia(
      item.mediaId,
      options.mediaLibrary,
      PREVIEW_DISCOVERY[index]?.image ??
        WEBSITE_MEDIA_PLACEHOLDERS.products[
          index % WEBSITE_MEDIA_PLACEHOLDERS.products.length
        ],
    ),
    href: resolveLink(item.href, options.baseLink, "/catalogue"),
    cta: item.linkLabel ?? COPY.home.discoveryCta,
  }));
}

function buildPromoBlocks(options: {
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  baseLink: (target: string) => string;
}): PromoBlock[] {
  const items = options.section?.items?.length ? options.section.items : [];
  const tones: PromoBlock["tone"][] = ["mint", "sun", "sky"];
  const mapped = items.map((item, index) => ({
    id: item.id,
    title: item.title ?? PREVIEW_PROMOS[index]?.title ?? COPY.home.promoTitle,
    description:
      item.description ??
      PREVIEW_PROMOS[index]?.description ??
      COPY.home.promoSubtitle,
    cta: item.linkLabel ?? PREVIEW_PROMOS[index]?.cta ?? COPY.home.promoCta,
    href: resolveLink(item.href, options.baseLink, "/catalogue"),
    image: resolveMedia(
      item.mediaId,
      options.mediaLibrary,
      PREVIEW_PROMOS[index]?.image ??
        WEBSITE_MEDIA_PLACEHOLDERS.promos[
          index % WEBSITE_MEDIA_PLACEHOLDERS.promos.length
        ],
    ),
    tone: tones[index % tones.length],
  }));
  const combined =
    mapped.length >= 2
      ? mapped
      : [...mapped, ...PREVIEW_PROMOS.slice(mapped.length, 2)];
  return combined.slice(0, 2);
}

function buildCategoryTiles(options: {
  section?: WebsiteBuilderSection | null;
  cards: CatalogCard[];
  mediaLibrary: WebsiteBuilderMediaAsset[];
  baseLink: (target: string) => string;
}): CategoryTile[] {
  const items = options.section?.items?.length ? options.section.items : [];
  if (items.length) {
    return items.slice(0, 6).map((item, index) => {
      const title = item.title ?? `Catégorie ${index + 1}`;
      const slug = slugify(title) || `categorie-${index + 1}`;
      return {
        id: item.id,
        title,
        description: item.description ?? COPY.home.exploreSubtitle,
        image: resolveMedia(
          item.mediaId,
          options.mediaLibrary,
          PREVIEW_CATEGORIES[index]?.image ??
            WEBSITE_MEDIA_PLACEHOLDERS.categories[
              index % WEBSITE_MEDIA_PLACEHOLDERS.categories.length
            ],
        ),
        href: resolveLink(item.href, options.baseLink, `/categories/${slug}`),
      };
    });
  }
  const categories = buildCategoryOptions(options.cards).slice(0, 6);
  if (categories.length) {
    return categories.map((category, index) => ({
      id: `category-${category.slug}`,
      title: category.label,
      description: COPY.home.categoryShowcaseSubtitle,
      image:
        PREVIEW_CATEGORIES[index]?.image ??
        WEBSITE_MEDIA_PLACEHOLDERS.categories[
          index % WEBSITE_MEDIA_PLACEHOLDERS.categories.length
        ],
      href: options.baseLink(`/categories/${category.slug}`),
    }));
  }
  return PREVIEW_CATEGORIES.map((card) => ({
    ...card,
    href: resolveLink(card.href, options.baseLink, "/catalogue"),
  }));
}

function buildBlogPosts(options: {
  section?: WebsiteBuilderSection | null;
  mediaLibrary: WebsiteBuilderMediaAsset[];
  baseLink: (target: string) => string;
}): BlogPost[] {
  const items = options.section?.items?.length ? options.section.items : [];
  if (!items.length) {
    return PREVIEW_BLOG_POSTS.map((post) => ({
      ...post,
      href: resolveLink(post.href, options.baseLink, "/catalogue"),
    }));
  }
  return items.slice(0, 4).map((item, index) => ({
    id: item.id,
    title: item.title ?? PREVIEW_BLOG_POSTS[index]?.title ?? "Article Cesco",
    excerpt:
      item.description ??
      PREVIEW_BLOG_POSTS[index]?.excerpt ??
      COPY.home.blogSubtitle,
    image: resolveMedia(
      item.mediaId,
      options.mediaLibrary,
      PREVIEW_BLOG_POSTS[index]?.image ??
        WEBSITE_MEDIA_PLACEHOLDERS.gallery[
          index % WEBSITE_MEDIA_PLACEHOLDERS.gallery.length
        ],
    ),
    href: resolveLink(item.href, options.baseLink, "/catalogue"),
    tag: item.tag ?? PREVIEW_BLOG_POSTS[index]?.tag ?? COPY.home.blogEyebrow,
    date: PREVIEW_BLOG_POSTS[index]?.date ?? "—",
  }));
}

function buildTestimonials(section?: WebsiteBuilderSection | null): Testimonial[] {
  const items = section?.items?.length ? section.items : [];
  if (!items.length) {
    return PREVIEW_TESTIMONIALS.map((item) => ({ ...item }));
  }
  return items.slice(0, 3).map((item, index) => ({
    id: item.id,
    quote: item.description ?? COPY.misc.proofQuoteFallback,
    name: item.title ?? `Client ${index + 1}`,
    role: item.tag ?? COPY.misc.proofRoleFallback,
    rating: 4.6 + (index % 3) * 0.1,
  }));
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

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      data-visible={visible}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
      className={className}
    >
      {children}
    </div>
  );
}

function FeatureIcon({ name }: { name: FeatureItem["icon"] }) {
  switch (name) {
    case "truck":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path
            d="M3 6h11v7h3.5l2.5 3v2h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3V6z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M3 6h11v7h4l2 3v2h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="7" cy="18" r="1.5" fill="currentColor" />
          <circle cx="15" cy="18" r="1.5" fill="currentColor" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path
            d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M12 3l2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path
            d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );
    case "gift":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
          <path
            d="M4 9h16v10H4z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M4 9h16v10H4V9zm0 0h16m-8 0v10"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M7 6c0-1.1.9-2 2-2 1.3 0 2.3 1 3 2 0-1.1.9-2 2-2 1.1 0 2 .9 2 2 0 1.8-2.2 3-4 3-1.8 0-5-1.2-5-3z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

function DepartmentIcon({ name }: { name: DepartmentItem["icon"] }) {
  switch (name) {
    case "women":
      return <span className="text-lg">W</span>;
    case "men":
      return <span className="text-lg">M</span>;
    case "kids":
      return <span className="text-lg">K</span>;
    case "home":
    default:
      return <span className="text-lg">H</span>;
  }
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
  const cartCountLabel = `${totalItems} produit${totalItems > 1 ? "s" : ""}`;
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
          className="group flex items-center gap-3 text-base font-semibold text-slate-900"
        >
          <span
            className={clsx(
              "flex h-10 w-10 items-center justify-center rounded-full bg-[var(--site-accent)] text-sm font-semibold text-white shadow-sm",
            )}
          >
            {company.companyName.slice(0, 1)}
          </span>
          <span className="hidden sm:inline">{company.companyName}</span>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
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
            className="relative rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {COPY.nav.cart}
            <span
              aria-hidden="true"
              className="ml-2 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white"
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
              "bg-[var(--site-accent)] px-4 text-white shadow-[0_18px_32px_-22px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
            )}
          >
            <a href={baseLink("/catalogue")}>{COPY.nav.cta}</a>
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
  const primaryLabel = section?.buttons?.[0]?.label ?? COPY.nav.cta;
  const secondaryLabel = section?.buttons?.[1]?.label ?? COPY.hero.secondaryCta;
  const primaryHref = resolveLink(
    section?.buttons?.[0]?.href,
    baseLink,
    "/catalogue",
  );
  const secondaryHref = resolveLink(
    section?.buttons?.[1]?.href,
    baseLink,
    "/catalogue",
  );
  const badges = COPY.hero.badges;
  const location = company.address ?? COPY.hero.locationFallback;

  return (
    <section
      id="hero"
      data-builder-section={section?.id}
      className={clsx(theme.sectionSpacing, "pt-8")}
    >
      <div className={clsx("mx-auto px-6 sm:px-8", theme.containerClass)}>
        <div
          className={clsx(
            "relative overflow-hidden bg-[var(--cesco-hero)] px-6 py-10 sm:px-10 sm:py-12 lg:px-12",
            theme.corner,
          )}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-8 left-6 h-16 w-16 rounded-full bg-emerald-300/60 blur-xl animate-[float_12s_ease-in-out_infinite]" />
            <div className="absolute right-8 top-6 h-10 w-10 rotate-12 rounded-2xl bg-orange-300/70 blur-sm animate-[float_14s_ease-in-out_infinite]" />
            <div className="absolute bottom-10 left-1/3 h-12 w-12 rounded-full bg-sky-200/80 blur-lg animate-[float_16s_ease-in-out_infinite]" />
          </div>
          <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-700">
                {eyebrow}
              </span>
              <h1 className="text-4xl font-semibold text-slate-900 sm:text-5xl">
                {title}
              </h1>
              <p className="text-base text-slate-600">{subtitle}</p>
              <div className="flex flex-wrap gap-2">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600"
                  >
                    {badge}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  className={clsx(
                    theme.buttonShape,
                    "bg-[var(--site-accent)] px-6 text-white shadow-[0_22px_40px_-26px_var(--site-accent)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]/40",
                  )}
                >
                  <a href={primaryHref}>{primaryLabel}</a>
                </Button>
                <a
                  href={secondaryHref}
                  className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4"
                >
                  {secondaryLabel}
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {location}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-6 top-10 hidden h-48 w-48 rounded-full bg-white/60 blur-2xl lg:block" />
              <div className="relative mx-auto aspect-[4/5] max-w-sm overflow-hidden rounded-[32px] bg-white shadow-[0_30px_60px_-30px_rgba(15,23,42,0.25)]">
                <Image
                  src={heroImage}
                  alt={COPY.hero.previewAlt}
                  width={680}
                  height={860}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductCard({
  card,
  baseLink,
  onAdd,
  variant = "default",
}: {
  card: CatalogCard;
  baseLink: (target: string) => string;
  onAdd?: (product: CatalogCard) => void;
  variant?: "default" | "compact";
}) {
  const isCompact = variant === "compact";
  const canAddToCart = isInstantPurchase(card);
  const addLabel = isCompact ? "Ajouter" : COPY.buttons.addToCart;
  const quoteLabel = isCompact ? "Devis" : COPY.buttons.quote;
  const actionLabel = card.saleMode === "QUOTE" ? quoteLabel : addLabel;
  const ctaHref = resolveCtaHref({
    saleMode: card.saleMode,
    baseLink,
    productSlug: card.slug,
    quoteAnchor: PRODUCT_QUOTE_ANCHOR,
  });

  return (
    <article
      className={clsx(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
        isCompact ? "p-3" : "p-4",
      )}
    >
      <a
        href={baseLink(`/produit/${card.slug}`)}
        className="relative block overflow-hidden rounded-2xl bg-slate-50"
      >
        <div className={clsx(isCompact ? "aspect-square" : "aspect-[4/5]")}>
          <Image
            src={card.image}
            alt={card.title}
            fill
            sizes={
              isCompact
                ? "(max-width: 768px) 60vw, 240px"
                : "(max-width: 768px) 50vw, 280px"
            }
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
        {card.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            {card.badge}
          </span>
        ) : null}
        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-xs text-slate-700 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12 20s-6.5-3.7-8.5-7.6C1.6 9.4 3.1 6 6.4 6c1.9 0 3.2 1 3.6 2.1C10.4 7 11.7 6 13.6 6c3.3 0 4.8 3.4 2.9 6.4C18.5 16.3 12 20 12 20z"
              fill="currentColor"
              opacity="0.2"
            />
            <path
              d="M12 20s-6.5-3.7-8.5-7.6C1.6 9.4 3.1 6 6.4 6c1.9 0 3.2 1 3.6 2.1C10.4 7 11.7 6 13.6 6c3.3 0 4.8 3.4 2.9 6.4C18.5 16.3 12 20 12 20z"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="none"
            />
          </svg>
        </span>
      </a>
      <div className={clsx("flex flex-1 flex-col", isCompact ? "mt-3" : "mt-4")}>
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          <span>{card.tag}</span>
          <span className="text-slate-900">{card.price}</span>
        </div>
        <h3 className="mt-2 text-sm font-semibold text-slate-900">
          {card.title}
        </h3>
        <p
          className={clsx(
            "text-xs text-slate-500",
            isCompact ? "truncate" : "",
          )}
        >
          {card.excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500">
              <path
                d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                fill="currentColor"
              />
            </svg>
            <span>{card.rating?.toFixed(1) ?? "4.8"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-200" />
            <span className="h-2 w-2 rounded-full bg-emerald-200" />
            <span className="h-2 w-2 rounded-full bg-amber-200" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <a
            href={baseLink(`/produit/${card.slug}`)}
            className="text-xs font-semibold text-slate-700"
          >
            {COPY.catalogue.viewProduct}
          </a>
          {canAddToCart ? (
            <button
              type="button"
              onClick={() => onAdd?.(card)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-black/5"
            >
              {addLabel}
            </button>
          ) : (
            <a
              href={ctaHref}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-black/5"
            >
              {actionLabel}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function CategoryTileCard({ tile }: { tile: CategoryTile }) {
  return (
    <a
      href={tile.href}
      className="group flex h-full flex-col gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-emerald-50">
        <Image
          src={tile.image}
          alt={tile.title}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{tile.title}</p>
        <p className="text-xs text-slate-500">{tile.description}</p>
      </div>
      <span className="mt-auto text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
        {COPY.home.discoveryCta}
      </span>
    </a>
  );
}

function BlogCard({
  post,
  variant = "large",
}: {
  post: BlogPost;
  variant?: "large" | "compact";
}) {
  if (variant === "compact") {
    return (
      <a
        href={post.href}
        className="flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
      >
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          <Image
            src={post.image}
            alt={post.title}
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-600">
            {post.tag}
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {post.title}
          </p>
          <p className="text-xs text-slate-500">{post.date}</p>
        </div>
      </a>
    );
  }

  return (
    <a
      href={post.href}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        <Image
          src={post.image}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-600">
          {post.tag}
        </p>
        <h3 className="text-lg font-semibold text-slate-900">
          {post.title}
        </h3>
        <p className="text-sm text-slate-500">{post.excerpt}</p>
        <span className="mt-auto text-xs font-semibold text-slate-500">
          {post.date}
        </span>
      </div>
    </a>
  );
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1 text-amber-500">
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
            fill="currentColor"
          />
        </svg>
        <span className="text-xs font-semibold text-slate-600">
          {item.rating.toFixed(1)}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-600">
        &ldquo;{item.quote}&rdquo;
      </p>
      <div className="mt-4 text-sm font-semibold text-slate-900">
        {item.name}
      </div>
      <div className="text-xs text-slate-500">{item.role}</div>
    </div>
  );
}

function DiscoverySection({
  theme,
  cards,
}: {
  theme: ThemeTokens;
  cards: DiscoveryCard[];
}) {
  return (
    <Section theme={theme} id="decouvrir">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.discoveryEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.discoveryTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.discoverySubtitle}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card, index) => (
            <Reveal key={card.id} delay={index * 80}>
              <a
                href={card.href}
                className="group flex h-full flex-col gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {card.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {card.description}
                    </p>
                  </div>
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                </div>
                <span className="mt-auto text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
                  {card.cta}
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function NewArrivalsSection({
  theme,
  cards,
  baseLink,
  onAdd,
}: {
  theme: ThemeTokens;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
  onAdd: (product: CatalogCard) => void;
}) {
  return (
    <Section theme={theme} id="nouveautes">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
              {COPY.home.newArrivalsEyebrow}
            </p>
            <h2 className="text-3xl font-semibold text-slate-900">
              {COPY.home.newArrivalsTitle}
            </h2>
            <p className="text-sm text-slate-600">
              {COPY.home.newArrivalsSubtitle}
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            className={clsx(
              theme.buttonShape,
              "border border-black/10 px-5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 hover:bg-black/5",
            )}
          >
            <a href={baseLink("/catalogue")}>{COPY.services.viewAll}</a>
          </Button>
        </div>
        {cards.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => (
              <Reveal key={card.id} delay={index * 70}>
                <ProductCard card={card} baseLink={baseLink} onAdd={onAdd} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-slate-500">
            <p className="text-base font-semibold text-slate-900">
              {COPY.services.emptyTitle}
            </p>
            <p className="mt-2">{COPY.services.emptySubtitle}</p>
          </div>
        )}
      </div>
    </Section>
  );
}

function FeatureRow({ theme }: { theme: ThemeTokens }) {
  return (
    <Section theme={theme} id="avantages" className="pt-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURE_ITEMS.map((item, index) => (
          <Reveal key={item.id} delay={index * 60}>
            <div className="flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <FeatureIcon name={item.icon} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="text-xs text-slate-500">{item.subtitle}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function PromoBlockSection({
  theme,
  promo,
  eyebrow,
  reverse = false,
  id,
}: {
  theme: ThemeTokens;
  promo: PromoBlock;
  eyebrow?: string;
  reverse?: boolean;
  id?: string;
}) {
  const toneMap: Record<PromoBlock["tone"], string> = {
    mint: "bg-emerald-50",
    sun: "bg-amber-50",
    sky: "bg-sky-50",
  };

  return (
    <Section theme={theme} id={id}>
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div
          className={clsx(
            "rounded-3xl p-8 shadow-sm",
            toneMap[promo.tone],
            reverse ? "lg:order-2" : "lg:order-1",
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-600">
            {eyebrow ?? COPY.home.promoEyebrow}
          </p>
          <h3 className="mt-3 text-3xl font-semibold text-slate-900">
            {promo.title}
          </h3>
          <p className="mt-3 text-sm text-slate-600">
            {promo.description}
          </p>
          <Button
            asChild
            className={clsx(
              theme.buttonShape,
              "mt-6 bg-slate-900 px-6 text-white shadow-[0_18px_30px_-20px_rgba(15,23,42,0.4)] hover:opacity-90",
            )}
          >
            <a href={promo.href}>{promo.cta}</a>
          </Button>
        </div>
        <div className={clsx(reverse ? "lg:order-1" : "lg:order-2")}>
          <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
            <div className="aspect-[4/3]">
              <Image
                src={promo.image}
                alt={promo.title}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function CategoryTilesSection({
  theme,
  tiles,
}: {
  theme: ThemeTokens;
  tiles: CategoryTile[];
}) {
  return (
    <Section theme={theme} id="categories">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.exploreEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.exploreTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.exploreSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tiles.slice(0, 4).map((tile) => (
            <span
              key={`chip-${tile.id}`}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {tile.title}
            </span>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile, index) => (
            <Reveal key={tile.id} delay={index * 70}>
              <CategoryTileCard tile={tile} />
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function BestSellersSection({
  theme,
  cards,
  baseLink,
  onAdd,
}: {
  theme: ThemeTokens;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
  onAdd: (product: CatalogCard) => void;
}) {
  return (
    <Section theme={theme} id="best-sellers">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.bestSellersEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.bestSellersTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.bestSellersSubtitle}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.length ? (
            cards.map((card, index) => (
              <Reveal key={card.id} delay={index * 70}>
                <ProductCard card={card} baseLink={baseLink} onAdd={onAdd} />
              </Reveal>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-black/10 bg-white p-8 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-4">
              <p className="text-base font-semibold text-slate-900">
                {COPY.services.emptyTitle}
              </p>
              <p className="mt-2">{COPY.services.emptySubtitle}</p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function ProductRailSection({
  theme,
  cards,
  baseLink,
  onAdd,
  categories,
}: {
  theme: ThemeTokens;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
  onAdd: (product: CatalogCard) => void;
  categories: CategoryOption[];
}) {
  return (
    <Section theme={theme} id="explorer">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.categoryShowcaseEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.categoryShowcaseTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.categoryShowcaseSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.slug}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {category.label}
            </span>
          ))}
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {cards.map((card) => (
            <div key={card.id} className="min-w-[220px]">
              <ProductCard
                card={card}
                baseLink={baseLink}
                onAdd={onAdd}
                variant="compact"
              />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function FavoritesSection({
  theme,
  cards,
  baseLink,
  onAdd,
}: {
  theme: ThemeTokens;
  cards: CatalogCard[];
  baseLink: (target: string) => string;
  onAdd: (product: CatalogCard) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categoryOptions = useMemo(
    () => buildCategoryOptions(cards).slice(0, 5),
    [cards],
  );
  const filterOptions = useMemo(
    () => [{ slug: null, label: COPY.home.favoritesAll }, ...categoryOptions],
    [categoryOptions],
  );
  const filteredCards = useMemo(() => {
    if (!activeCategory) return cards;
    return cards.filter((card) => card.categorySlug === activeCategory);
  }, [activeCategory, cards]);

  return (
    <Section theme={theme} id="favoris">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.favoritesEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.favoritesTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.favoritesSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => {
            const isActive = filter.slug === activeCategory;
            return (
              <button
                key={filter.slug ?? "all"}
                type="button"
                onClick={() => setActiveCategory(filter.slug)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-black/10 bg-white text-slate-600 hover:border-slate-900/40 hover:text-slate-900",
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filteredCards.slice(0, 8).map((card, index) => (
            <Reveal key={card.id} delay={index * 60}>
              <ProductCard card={card} baseLink={baseLink} onAdd={onAdd} />
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function DepartmentsSection({ theme }: { theme: ThemeTokens }) {
  return (
    <Section theme={theme} id="departements">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.departmentsEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.departmentsTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.departmentsSubtitle}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEPARTMENT_ITEMS.map((item, index) => (
            <Reveal key={item.id} delay={index * 60}>
              <div className="flex items-center gap-4 rounded-3xl border border-black/5 bg-white p-4 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <DepartmentIcon name={item.icon} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500">{item.subtitle}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}

function BlogSection({
  theme,
  posts,
}: {
  theme: ThemeTokens;
  posts: BlogPost[];
}) {
  const [featured, ...rest] = posts;
  if (!featured) return null;

  return (
    <Section theme={theme} id="blog">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.blogEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.blogTitle}
          </h2>
          <p className="text-sm text-slate-600">{COPY.home.blogSubtitle}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Reveal delay={40}>
            <BlogCard post={featured} />
          </Reveal>
          <div className="grid gap-4">
            {rest.map((post, index) => (
              <Reveal key={post.id} delay={60 + index * 60}>
                <BlogCard post={post} variant="compact" />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function TestimonialsSection({
  theme,
  items,
}: {
  theme: ThemeTokens;
  items: Testimonial[];
}) {
  if (!items.length) return null;
  const [featured, ...rest] = items;

  return (
    <Section theme={theme} id="temoignages">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600">
            {COPY.home.testimonialsEyebrow}
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">
            {COPY.home.testimonialsTitle}
          </h2>
          <p className="text-sm text-slate-600">
            {COPY.home.testimonialsSubtitle}
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <Reveal delay={40}>
            <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M12 3l2.6 5.3 5.9.9-4.2 4.1 1 5.9L12 16.6 6.7 19l1-5.9L3.5 9.2l5.9-.9L12 3z"
                    fill="currentColor"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-700">
                  {featured.rating.toFixed(1)}
                </span>
              </div>
              <p className="mt-4 text-lg text-slate-700">
                &ldquo;{featured.quote}&rdquo;
              </p>
              <div className="mt-6 text-sm font-semibold text-slate-900">
                {featured.name}
              </div>
              <div className="text-xs text-slate-500">{featured.role}</div>
            </div>
          </Reveal>
          <div className="grid gap-4">
            {rest.map((item, index) => (
              <Reveal key={item.id} delay={80 + index * 60}>
                <TestimonialCard item={item} />
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function HomePage({
  theme,
  baseLink,
  company,
  mediaLibrary,
  heroSection,
  discoverySection,
  promoSection,
  categorySection,
  blogSection,
  testimonialSection,
  cards,
  featuredCards,
}: {
  theme: ThemeTokens;
  baseLink: (target: string) => string;
  company: CatalogPayload["website"]["contact"];
  mediaLibrary: WebsiteBuilderMediaAsset[];
  heroSection?: WebsiteBuilderSection | null;
  discoverySection?: WebsiteBuilderSection | null;
  promoSection?: WebsiteBuilderSection | null;
  categorySection?: WebsiteBuilderSection | null;
  blogSection?: WebsiteBuilderSection | null;
  testimonialSection?: WebsiteBuilderSection | null;
  cards: CatalogCard[];
  featuredCards: CatalogCard[];
}) {
  const { addItem } = useCart();
  const discoveryCards = useMemo(
    () =>
      buildDiscoveryCards({
        section: discoverySection,
        mediaLibrary,
        baseLink,
      }),
    [baseLink, discoverySection, mediaLibrary],
  );
  const promoBlocks = useMemo(
    () =>
      buildPromoBlocks({
        section: promoSection,
        mediaLibrary,
        baseLink,
      }),
    [baseLink, mediaLibrary, promoSection],
  );
  const categoryTiles = useMemo(
    () =>
      buildCategoryTiles({
        section: categorySection,
        cards,
        mediaLibrary,
        baseLink,
      }),
    [baseLink, cards, categorySection, mediaLibrary],
  );
  const blogPosts = useMemo(
    () =>
      buildBlogPosts({
        section: blogSection,
        mediaLibrary,
        baseLink,
      }),
    [baseLink, blogSection, mediaLibrary],
  );
  const testimonials = useMemo(
    () => buildTestimonials(testimonialSection),
    [testimonialSection],
  );
  const newArrivals = cards.slice(0, 4);
  const bestSellers = (featuredCards.length ? featuredCards : cards).slice(0, 4);
  const railCards = cards.slice(0, 6);
  const railCategories = buildCategoryOptions(cards).slice(0, 5);

  return (
    <>
      <HeroSection
        theme={theme}
        section={heroSection}
        baseLink={baseLink}
        company={company}
        mediaLibrary={mediaLibrary}
      />
      <DiscoverySection theme={theme} cards={discoveryCards} />
      <NewArrivalsSection
        theme={theme}
        cards={newArrivals}
        baseLink={baseLink}
        onAdd={addItem}
      />
      <FeatureRow theme={theme} />
      <PromoBlockSection
        theme={theme}
        promo={promoBlocks[0]}
        eyebrow={COPY.home.promoEyebrow}
        id="promo"
      />
      <CategoryTilesSection theme={theme} tiles={categoryTiles} />
      <BestSellersSection
        theme={theme}
        cards={bestSellers}
        baseLink={baseLink}
        onAdd={addItem}
      />
      <PromoBlockSection
        theme={theme}
        promo={promoBlocks[1]}
        eyebrow={COPY.home.specialOfferEyebrow}
        id="promo-kids"
        reverse
      />
      <ProductRailSection
        theme={theme}
        cards={railCards}
        baseLink={baseLink}
        onAdd={addItem}
        categories={railCategories}
      />
      <FavoritesSection
        theme={theme}
        cards={cards}
        baseLink={baseLink}
        onAdd={addItem}
      />
      <DepartmentsSection theme={theme} />
      <BlogSection theme={theme} posts={blogPosts} />
      <TestimonialsSection theme={theme} items={testimonials} />
    </>
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
  const filteredCards =
    !activeCategorySlug && !normalizedSearch
      ? cards
      : cards.filter((card) => {
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
  mode: "public" | "preview";
  path?: string | null;
  slug: string;
  spamProtectionEnabled: boolean;
  pricingSection?: WebsiteBuilderSection | null;
  faqSection?: WebsiteBuilderSection | null;
  upsellSection?: WebsiteBuilderSection | null;
  upsellCards: CatalogCard[];
}) {
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
  const summaryHtml = current.shortDescriptionHtml?.trim() || null;
  const summary = summaryHtml
    ? null
    : current.productExcerpt?.trim() || null;
  const details =
    current.description && current.description !== (summary ?? "")
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
            {summaryHtml ? (
              <div
                className="text-base leading-7 text-slate-600 [&_a]:text-[var(--site-accent)] [&_a]:underline [&_strong]:font-semibold"
                dangerouslySetInnerHTML={{ __html: summaryHtml }}
              />
            ) : summary ? (
              <p className="text-base text-slate-600">{summary}</p>
            ) : null}
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
        <ProductGallery
          key={current.id}
          theme={theme}
          images={gallery}
          title={current.title}
        />
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
                {totalItems} produit{totalItems > 1 ? "s" : ""}
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
      const methods: Array<{
        id: CheckoutPaymentMethod;
        label: string;
      }> = [];

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
  const shopLinks = [
    { label: "Nouveautés", href: baseLink("/catalogue") },
    { label: "Collections", href: baseLink("/catalogue") },
    { label: "Panier", href: baseLink("/panier") },
  ];
  const companyLinks = [
    { label: COPY.nav.home, href: baseLink("/") },
    { label: COPY.nav.contact, href: baseLink("/contact") },
    { label: "Blog", href: baseLink("/catalogue") },
  ];
  const helpLinks = [
    { label: "Livraison", href: baseLink("/contact") },
    { label: "Retours", href: baseLink("/contact") },
    { label: "Support", href: baseLink("/contact") },
  ];
  return (
    <footer className="border-t border-black/10 bg-white">
      <div
        className={clsx(
          "mx-auto px-6 py-12 text-sm text-slate-600",
          theme.containerClass,
        )}
      >
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(3,0.8fr)]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--site-accent)] text-sm font-semibold text-white">
                {company.companyName.slice(0, 1)}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-900">
                  {company.companyName}
                </p>
                <p className="text-xs text-slate-500">{COPY.footer.tagline}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              {company.email ? (
                <p>
                  <span className="text-slate-500">Email:</span>{" "}
                  <a href={`mailto:${company.email}`}>{company.email}</a>
                </p>
              ) : null}
              {company.phone ? (
                <p>
                  <span className="text-slate-500">Téléphone:</span>{" "}
                  <a href={`tel:${company.phone}`}>{company.phone}</a>
                </p>
              ) : null}
              {company.address ? (
                <p className="text-slate-500">{company.address}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Boutique
            </p>
            <div className="space-y-2">
              {shopLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-slate-600 hover:text-slate-900"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Cesco
            </p>
            <div className="space-y-2">
              {companyLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-slate-600 hover:text-slate-900"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              {COPY.footer.newsletterTitle}
            </p>
            <p className="text-sm text-slate-600">
              {COPY.footer.newsletterSubtitle}
            </p>
            <form className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                name="newsletterEmail"
                autoComplete="email"
                aria-label={COPY.footer.newsletterLabel}
                placeholder={COPY.footer.newsletterPlaceholder}
                className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
              >
                {COPY.footer.newsletterCta}
              </button>
            </form>
            <div className="space-y-2 text-sm text-slate-600">
              {helpLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="block text-sm text-slate-600 hover:text-slate-900"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-black/5 pt-6 text-xs text-slate-500 sm:flex-row">
          <span>Copyright {new Date().getFullYear()} - {COPY.footer.rights}</span>
          <div className="flex gap-4">
            <a href={baseLink("/contact")} className="hover:text-slate-900">
              CGV
            </a>
            <a href={baseLink("/contact")} className="hover:text-slate-900">
              Politique de retour
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function EcommerceCescoTemplate({
  data,
  mode,
  path,
}: TemplateProps) {
  const builder = data.website.builder;
  const accent = builder.theme?.accent ?? data.website.accentColor ?? "#22c55e";
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
    "--cesco-bg": "#f8fbf8",
    "--cesco-hero": "#e7fbe8",
    "--cesco-surface": "#ffffff",
    "--cesco-ink": "#0f172a",
    "--cesco-muted": "#64748b",
    fontFamily: 'var(--font-geist-sans), "Sora", sans-serif',
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
  const discoverySection = resolveSection(sections, "services", ["products", "content"]);
  const categorySection = resolveSection(sections, "categories", ["gallery"]);
  const promoSection = resolveSection(sections, "promo", ["newsletter"]);
  const blogSection = resolveSection(sections, "gallery", ["content"]);
  const testimonialSection = resolveSection(sections, "testimonials");
  const pricingSection = resolveSection(sections, "pricing");
  const faqSection = resolveSection(sections, "faq");
  const page = resolvePage(path);
  const baseLink = (target: string) =>
    mode === "preview"
      ? `/preview?path=${encodeURIComponent(normalizePath(target))}`
      : `/catalogue/${data.website.slug}${normalizePath(target)}`;

  const usePreviewFallback =
    mode === "preview" && data.products.all.length === 0;
  const productSource = usePreviewFallback ? PREVIEW_PRODUCTS : data.products.all;
  const featuredSource = usePreviewFallback
    ? PREVIEW_PRODUCTS
    : data.products.featured.length
      ? data.products.featured
      : data.products.all;

  const allCards = useMemo(
    () =>
      buildServiceCards({
        products: productSource,
        currencyCode,
        showPrices: data.website.showPrices,
      }),
    [
      productSource,
      currencyCode,
      data.website.showPrices,
    ],
  );
  const featuredCards = useMemo(
    () =>
      buildServiceCards({
        products: featuredSource,
        currencyCode,
        showPrices: data.website.showPrices,
      }),
    [
      featuredSource,
      currencyCode,
      data.website.showPrices,
    ],
  );
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
        className="relative min-h-screen bg-[var(--cesco-bg)] text-[var(--cesco-ink)]"
        style={inlineStyles}
      >
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(circle at top, rgba(34, 197, 94, 0.12), transparent 55%)",
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
          <HomePage
            theme={theme}
            baseLink={baseLink}
            company={data.website.contact}
            mediaLibrary={mediaLibrary}
            heroSection={heroSection}
            discoverySection={discoverySection}
            promoSection={promoSection}
            categorySection={categorySection}
            blogSection={blogSection}
            testimonialSection={testimonialSection}
            cards={allCards}
            featuredCards={featuredCards}
          />
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
            mode={mode}
            path={path}
            slug={data.website.slug}
            spamProtectionEnabled={data.website.spamProtectionEnabled}
            pricingSection={pricingSection}
            faqSection={faqSection}
            upsellSection={discoverySection}
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
          [data-reveal] {
            opacity: 0;
            transform: translateY(16px);
            transition: opacity 0.6s ease, transform 0.6s ease;
            transition-delay: var(--reveal-delay, 0ms);
          }
          [data-reveal][data-visible="true"] {
            opacity: 1;
            transform: translateY(0);
          }
          @media (prefers-reduced-motion: reduce) {
            [data-reveal] {
              opacity: 1;
              transform: none;
              transition: none;
            }
            .animate-[float_12s_ease-in-out_infinite],
            .animate-[float_14s_ease-in-out_infinite],
            .animate-[float_16s_ease-in-out_infinite] {
              animation: none;
            }
          }
        `}</style>
      </div>
    </CartProvider>
  );
}
