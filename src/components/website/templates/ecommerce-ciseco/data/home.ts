import type {
  BlogPost,
  CategoryCard,
  DepartmentCard,
  DiscoveryCard,
  FeatureItem,
  ProductCardData,
  Testimonial,
} from "../types";

export const HERO_IMAGE =
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80";
export const PROMO_IMAGE =
  "https://images.unsplash.com/photo-1565514020179-026b92b84bb6?auto=format&fit=crop&w=900&q=80";
export const KIDS_PROMO_IMAGE =
  "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=900&q=80";

export const DISCOVERY_CARDS: DiscoveryCard[] = [
  {
    id: "discover-1",
    title: "Basketball",
    description: "Sport-ready styles for the new season.",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=480&q=80",
    cta: "Shop now",
    href: "#",
  },
  {
    id: "discover-2",
    title: "Backpack",
    description: "Daily carry essentials with clean lines.",
    image:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=480&q=80",
    cta: "Explore",
    href: "#",
  },
  {
    id: "discover-3",
    title: "Sportswear",
    description: "Street-ready comfort in modern cuts.",
    image:
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=480&q=80",
    cta: "View all",
    href: "#",
  },
  {
    id: "discover-4",
    title: "Beauty care",
    description: "Fresh drops, soft scents, bold moods.",
    image:
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=480&q=80",
    cta: "View all",
    href: "#",
  },
];

export const PRODUCT_CARDS: ProductCardData[] = [
  {
    id: "prod-1",
    name: "Denim Button Shirt",
    category: "Men",
    price: "$48.00",
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80",
    colors: ["#e2e8f0", "#94a3b8", "#0f172a"],
    badge: "New",
  },
  {
    id: "prod-2",
    name: "Striped Oxford",
    category: "Women",
    price: "$52.00",
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=700&q=80",
    colors: ["#fecaca", "#fda4af", "#fb7185"],
  },
  {
    id: "prod-3",
    name: "Soft Summer Dress",
    category: "Women",
    price: "$58.00",
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=700&q=80",
    colors: ["#bbf7d0", "#86efac", "#22c55e"],
  },
  {
    id: "prod-4",
    name: "Lightweight Jacket",
    category: "Men",
    price: "$74.00",
    rating: 4.6,
    image:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=700&q=80",
    colors: ["#e5e7eb", "#cbd5f5", "#6366f1"],
    badge: "Hot",
  },
  {
    id: "prod-5",
    name: "Running Sneakers",
    category: "Sport",
    price: "$86.00",
    rating: 4.9,
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80",
    colors: ["#fef9c3", "#fde68a", "#f59e0b"],
  },
  {
    id: "prod-6",
    name: "Canvas Backpack",
    category: "Accessories",
    price: "$44.00",
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=700&q=80",
    colors: ["#dbeafe", "#93c5fd", "#1d4ed8"],
  },
  {
    id: "prod-7",
    name: "Minimal Tote",
    category: "Women",
    price: "$40.00",
    rating: 4.4,
    image:
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=700&q=80",
    colors: ["#fecdd3", "#f472b6", "#db2777"],
  },
  {
    id: "prod-8",
    name: "Daily Tee",
    category: "Men",
    price: "$28.00",
    rating: 4.6,
    image:
      "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=700&q=80",
    colors: ["#e2e8f0", "#cbd5e1", "#94a3b8"],
  },
  {
    id: "prod-9",
    name: "Graphic Hoodie",
    category: "Kids",
    price: "$36.00",
    rating: 4.7,
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=700&q=80",
    colors: ["#ddd6fe", "#c4b5fd", "#8b5cf6"],
    badge: "Sale",
  },
  {
    id: "prod-10",
    name: "Soft Knit",
    category: "Women",
    price: "$62.00",
    rating: 4.8,
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=700&q=80",
    colors: ["#fee2e2", "#fecaca", "#f87171"],
  },
  {
    id: "prod-11",
    name: "Scented Set",
    category: "Beauty",
    price: "$39.00",
    rating: 4.6,
    image:
      "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=700&q=80",
    colors: ["#fef3c7", "#fde68a", "#fbbf24"],
  },
  {
    id: "prod-12",
    name: "Pocket Shorts",
    category: "Sport",
    price: "$32.00",
    rating: 4.5,
    image:
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=700&q=80",
    colors: ["#e0f2fe", "#bae6fd", "#38bdf8"],
  },
];

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    id: "feature-1",
    title: "Free shipping",
    subtitle: "Orders over $50",
    icon: "shipping",
  },
  {
    id: "feature-2",
    title: "Easy returns",
    subtitle: "30-day policy",
    icon: "return",
  },
  {
    id: "feature-3",
    title: "Secure payment",
    subtitle: "Encrypted checkout",
    icon: "secure",
  },
  {
    id: "feature-4",
    title: "Online support",
    subtitle: "24/7 friendly team",
    icon: "support",
  },
];

export const CATEGORY_TABS = ["Women", "Men", "Kids", "Beauty", "Sport"];

export const FAVORITE_FILTERS = [
  "All",
  "Women",
  "Men",
  "Kids",
  "Sport",
  "Beauty",
];

export const CATEGORY_CARDS: CategoryCard[] = [
  {
    id: "cat-1",
    title: "Women",
    description: "New arrivals weekly",
    icon: "women",
  },
  {
    id: "cat-2",
    title: "Men",
    description: "Essentials for every day",
    icon: "men",
  },
  {
    id: "cat-3",
    title: "Kids",
    description: "Playful and comfy picks",
    icon: "kids",
  },
  {
    id: "cat-4",
    title: "Beauty",
    description: "Fresh care rituals",
    icon: "beauty",
  },
  {
    id: "cat-5",
    title: "Sport",
    description: "Move-ready gear",
    icon: "sport",
  },
  {
    id: "cat-6",
    title: "Home",
    description: "Decor and cozy accents",
    icon: "home",
  },
];

export const DEPARTMENTS: DepartmentCard[] = [
  {
    id: "dept-1",
    title: "Men",
    subtitle: "Layered classics",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "dept-2",
    title: "Women",
    subtitle: "Soft silhouettes",
    image:
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "dept-3",
    title: "Kids",
    subtitle: "Bright essentials",
    image:
      "https://images.unsplash.com/photo-1503455637927-730bce8583c0?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: "dept-4",
    title: "Pets",
    subtitle: "Cozy picks",
    image:
      "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=600&q=80",
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "blog-1",
    title: "The spring capsule everyone wants",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
    tag: "Collection",
    date: "April 12, 2024",
  },
  {
    id: "blog-2",
    title: "The everyday sneaker guide",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image:
      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=600&q=80",
    tag: "Guide",
    date: "April 08, 2024",
  },
  {
    id: "blog-3",
    title: "Home tones that warm a room",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80",
    tag: "Lifestyle",
    date: "April 02, 2024",
  },
  {
    id: "blog-4",
    title: "Gift edits for every mood",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    tag: "Gifts",
    date: "March 28, 2024",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "test-1",
    quote:
      "The styling and delivery are always on point. Every drop feels special.",
    name: "Sarah L.",
    role: "Verified customer",
    rating: 4.9,
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "test-2",
    quote:
      "Great quality and fast support. I love the weekly picks and curation.",
    name: "James K.",
    role: "Member",
    rating: 4.8,
    avatar:
      "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "test-3",
    quote:
      "The packaging is gorgeous and returns are super easy to manage.",
    name: "Mina R.",
    role: "Customer",
    rating: 4.7,
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80",
  },
  {
    id: "test-4",
    quote:
      "I keep coming back for the accessories. The styling tips are gold.",
    name: "Andre J.",
    role: "Customer",
    rating: 4.8,
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80",
  },
];
