export type ThemeTokens = {
  accent: string;
  containerClass: string;
  sectionSpacing: string;
  corner: string;
  buttonShape: string;
};

export type NavItem = {
  label: string;
  href: string;
};

export type DiscoveryCard = {
  id: string;
  title: string;
  description: string;
  image: string;
  cta: string;
  href: string;
};

export type ProductCardData = {
  id: string;
  name: string;
  category: string;
  price: string;
  rating?: number | null;
  reviewCount?: number;
  image: string;
  colors: string[];
  badge?: string;
};

export type HomeProduct = ProductCardData & {
  slug: string;
  saleMode: "INSTANT" | "QUOTE";
  unitAmountCents: number | null;
  unitPriceHTCents: number | null;
  vatRate: number | null;
  discountRate: number | null;
  discountAmountCents?: number | null;
  currencyCode: string;
};

export type HomeProductStatus = "loading" | "error" | "empty" | "ready";

export type FeatureItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: "shipping" | "return" | "secure" | "support";
};

export type CategoryCard = {
  id: string;
  title: string;
  description: string;
  icon:
    | "workspace"
    | "planning"
    | "analytics"
    | "operations"
    | "support"
    | "resources";
  badge?: string | null;
  href?: string;
};

export type DepartmentCard = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href?: string;
};

export type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  tag: string;
  date: string;
  href?: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  rating: number;
  avatar: string;
};

export type FooterLink = {
  label: string;
  href: string;
};

export type FooterLinkGroup = {
  title: string;
  links: FooterLink[];
};

export type PageDescriptor =
  | { page: "home" }
  | { page: "blog" }
  | { page: "blog-detail"; slug?: string }
  | { page: "cms"; cmsPath: string }
  | { page: "contact" }
  | { page: "about" }
  | { page: "search" }
  | { page: "collections"; collectionSlug?: string }
  | { page: "product"; productSlug?: string }
  | { page: "cart" }
  | { page: "checkout" }
  | { page: "order-success" }
  | { page: "login" }
  | { page: "signup" }
  | { page: "forgot-password" }
  | { page: "account" }
  | { page: "account-wishlists" }
  | { page: "account-orders-history" }
  | { page: "account-change-password" }
  | { page: "account-order-detail"; orderId?: string };

export type CartItem = {
  id: string;
  name: string;
  color: string;
  size: string;
  price: string;
  quantity: number;
  image: string;
  stockLabel: string;
};

export type ProductGalleryImage = {
  id: string;
  src: string;
  alt: string;
};

export type ProductColorOption = {
  id: string;
  label: string;
  swatch: string;
};

export type ProductInfoCard = {
  id: string;
  title: string;
  description: string;
  icon: "shipping" | "return" | "delivery" | "refund";
  tone: "mint" | "sky" | "sun" | "rose";
};

export type ProductReviewCard = {
  id: string;
  name: string;
  date: string;
  rating: number;
  body: string;
  avatar?: string;
  title?: string | null;
};

export type PurchasedProductCard = {
  id: string;
  name: string;
  price: string;
  rating: number;
  reviewCount: number;
  image: string;
  href?: string;
  badge?: string;
  colors: string[];
};

export type ProductDetail = {
  slug: string;
  name: string;
  price: string;
  rating: number;
  reviewCount: number;
  stockLabel: string;
  colors: ProductColorOption[];
  sizes: string[];
  gallery: ProductGalleryImage[];
};

export type ProductAccordionItem = {
  id: string;
  title: string;
  body: ReactNode;
};

export type OrderSuccessItem = {
  id: string;
  name: string;
  color: string;
  size: string;
  price: string;
  quantity: number;
  image: string;
};

export type OrderSuccessTotals = {
  subtotal: string;
  shipping: string;
  taxes: string;
  total: string;
};

export type OrderSuccessAddress = {
  name: string;
  lines: string[];
};

export type OrderSuccessPayment = {
  brand: string;
  last4: string;
  expires: string;
};
import type { ReactNode } from "react";
