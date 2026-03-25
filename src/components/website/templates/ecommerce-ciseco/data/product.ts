import type {
  ProductAccordionItem,
  ProductColorOption,
  ProductDetail,
  ProductGalleryImage,
  ProductInfoCard,
  ProductReviewCard,
  PurchasedProductCard,
} from "../types";
import { PRODUCT_CARDS } from "./home";

const PRODUCT_DETAIL_GALLERY: ProductGalleryImage[] = [
  {
    id: "gallery-1",
    src: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
    alt: "Leather tote bag front view",
  },
  {
    id: "gallery-2",
    src: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80",
    alt: "Leather tote bag side view",
  },
  {
    id: "gallery-3",
    src: "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=900&q=80",
    alt: "Leather tote bag in studio",
  },
  {
    id: "gallery-4",
    src: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
    alt: "Leather tote bag back detail",
  },
  {
    id: "gallery-5",
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    alt: "Leather tote bag styling",
  },
];

const PRODUCT_DETAIL_COLORS: ProductColorOption[] = [
  { id: "charcoal", label: "Charcoal", swatch: "#111827" },
  { id: "cognac", label: "Cognac", swatch: "#9a6b3b" },
  { id: "sand", label: "Sand", swatch: "#e7d3bf" },
  { id: "blush", label: "Blush", swatch: "#f0b7a4" },
];

const PRODUCT_DETAIL_SIZES = ["2XS", "XS", "S", "M", "L", "XL"];

export const PRODUCT_DETAIL: ProductDetail = {
  slug: "leather-tote-bag",
  name: "Leather Tote Bag",
  price: "$65.00",
  rating: 4.5,
  reviewCount: 87,
  stockLabel: "In stock",
  colors: PRODUCT_DETAIL_COLORS,
  sizes: PRODUCT_DETAIL_SIZES,
  gallery: PRODUCT_DETAIL_GALLERY,
};

export const PRODUCT_ACCORDION: ProductAccordionItem[] = [
  {
    id: "description",
    title: "Description",
    body:
      "Fashion is a form of self-expression and autonomy at a given period and place and in a specific context.",
  },
  {
    id: "fabric",
    title: "Fabric + Care",
    body:
      "Made from 100% cotton canvas. Hand wash cold, reshape while damp, and lay flat to dry.",
  },
  {
    id: "fit",
    title: "How it Fits",
    body:
      "Relaxed fit with a soft drape. True to size for a comfortable everyday feel.",
  },
  {
    id: "faq",
    title: "FAQ",
    body:
      "Questions about materials or delivery? Reach out anytime at support@ciseco.com.",
  },
];

export const PRODUCT_INFO_CARDS: ProductInfoCard[] = [
  {
    id: "info-shipping",
    title: "Free shipping",
    description: "On orders over $50.00",
    icon: "shipping",
    tone: "rose",
  },
  {
    id: "info-return",
    title: "Easy returns",
    description: "30-day return window",
    icon: "return",
    tone: "sky",
  },
  {
    id: "info-delivery",
    title: "Nationwide delivery",
    description: "Across the country",
    icon: "delivery",
    tone: "mint",
  },
  {
    id: "info-refunds",
    title: "Refunds policy",
    description: "A guarantee of quality",
    icon: "refund",
    tone: "sun",
  },
];

export const PRODUCT_DETAILS_PARAGRAPHS = [
  "The patented signature knit and relaxed drape deliver a soft, lightweight feel for everyday wear. Cut from durable canvas, the tote is designed to carry essentials without losing its shape.",
  "This item is sourced with care, woven from long-staple fibers and finished with a clean matte texture. It is designed to age beautifully with every use.",
];

export const PRODUCT_DETAILS_BULLETS = [
  "Signature knit, regular length",
  "Machine washable, low tumble dry",
  "Quality stitching with reinforced seams",
  "Unisex styling with an easy carry",
];

export const PRODUCT_REVIEWS: ProductReviewCard[] = [
  {
    id: "review-1",
    name: "S. Wilkinson",
    date: "May 13, 2023",
    rating: 5,
    body:
      "I was really pleased with the overall shopping experience. The product quality is outstanding.",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "review-2",
    name: "Rilona M",
    date: "May 12, 2023",
    rating: 4,
    body:
      "The product quality is amazing, it looks and feels even better than I had anticipated.",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "review-3",
    name: "Brian Finch",
    date: "May 11, 2023",
    rating: 5,
    body:
      "I would gladly recommend this store to my friends. And now that I think of it, I actually have many times.",
    avatar:
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "review-4",
    name: "Jonathan Edwards",
    date: "May 10, 2023",
    rating: 4,
    body:
      "I was very impressed with how quickly everything arrived, and the packaging is stunning.",
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80",
  },
];

export const ALSO_PURCHASED_PRODUCTS: PurchasedProductCard[] = [
  {
    id: "also-1",
    name: "Denim Jacket",
    price: "$48.00",
    rating: 4.8,
    reviewCount: 64,
    image: PRODUCT_CARDS[0].image,
    badge: "New",
    colors: PRODUCT_CARDS[0].colors,
  },
  {
    id: "also-2",
    name: "Cashmere Sweater",
    price: "$52.00",
    rating: 4.7,
    reviewCount: 38,
    image: PRODUCT_CARDS[1].image,
    badge: "Sale",
    colors: PRODUCT_CARDS[1].colors,
  },
  {
    id: "also-3",
    name: "Linen Blazer",
    price: "$35.00",
    rating: 4.6,
    reviewCount: 51,
    image: PRODUCT_CARDS[2].image,
    badge: "Hot",
    colors: PRODUCT_CARDS[2].colors,
  },
  {
    id: "also-4",
    name: "Velvet Skirt",
    price: "$39.00",
    rating: 4.5,
    reviewCount: 22,
    image: PRODUCT_CARDS[3].image,
    colors: PRODUCT_CARDS[3].colors,
  },
];
