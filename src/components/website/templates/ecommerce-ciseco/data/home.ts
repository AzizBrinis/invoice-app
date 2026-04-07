import type {
  BlogPost,
  CategoryCard,
  DepartmentCard,
  DiscoveryCard,
  FeatureItem,
  ProductCardData,
  Testimonial,
} from "../types";

const PLACEHOLDER_IMAGE = {
  hero: "/images/placeholders/hero-collage.svg",
  workspace: "/images/placeholders/workspace-grid.svg",
  aurora: "/images/placeholders/gallery-aurora.svg",
  nova: "/images/placeholders/gallery-nova.svg",
  atlas: "/images/placeholders/gallery-atlas.svg",
  portrait1: "/images/placeholders/portrait-1.svg",
  portrait2: "/images/placeholders/portrait-2.svg",
  portrait3: "/images/placeholders/portrait-3.svg",
} as const;

export const HERO_IMAGE = PLACEHOLDER_IMAGE.hero;
export const PROMO_IMAGE = PLACEHOLDER_IMAGE.workspace;
export const KIDS_PROMO_IMAGE = PLACEHOLDER_IMAGE.aurora;

export const HOME_HERO_SLIDES = [
  {
    id: "home-hero-slide-1",
    eyebrow: "Collection signature",
    title: "A refined homepage slider that feels calm, clean, and premium",
    subtitle:
      "Showcase your strongest offer with generous space, elegant pacing, and clear calls to action.",
    note: "Built to stay flexible across catalog, service, or editorial websites.",
    image: PLACEHOLDER_IMAGE.hero,
    contentBackground: "mist",
    buttons: [
      {
        label: "Browse collections",
        href: "/collections",
        style: "primary" as const,
      },
      {
        label: "See sections",
        href: "#discover",
        style: "ghost" as const,
      },
    ],
  },
  {
    id: "home-hero-slide-2",
    eyebrow: "Visual storytelling",
    title: "Use full-size imagery when you want a stronger first impression",
    subtitle:
      "Large photos, subtle overlays, and balanced typography keep the hero expressive without feeling heavy.",
    note: "Image mode works well for launches, collections, and campaigns.",
    image: PLACEHOLDER_IMAGE.workspace,
    contentBackground: "sage",
    buttons: [
      {
        label: "Highlight a campaign",
        href: "/about",
        style: "primary" as const,
      },
      {
        label: "Contact us",
        href: "/contact",
        style: "secondary" as const,
      },
    ],
  },
  {
    id: "home-hero-slide-3",
    eyebrow: "Minimal alternative",
    title: "Switch to a simpler content slider anytime",
    subtitle:
      "Keep the layout light and editorial when text and actions matter more than photography.",
    note: "A clean content mode stays polished on desktop, tablet, and mobile.",
    image: PLACEHOLDER_IMAGE.aurora,
    contentBackground: "navy",
    buttons: [
      {
        label: "Start customizing",
        href: "/collections",
        style: "primary" as const,
      },
    ],
  },
] as const;

export const DISCOVERY_CARDS: DiscoveryCard[] = [
  {
    id: "discover-1",
    title: "Reusable sections",
    description: "Neutral blocks that adapt to many kinds of businesses.",
    image: PLACEHOLDER_IMAGE.aurora,
    cta: "Explore",
    href: "/about",
  },
  {
    id: "discover-2",
    title: "Balanced layouts",
    description: "Clean spacing and simple hierarchy for fast customization.",
    image: PLACEHOLDER_IMAGE.nova,
    cta: "Explore",
    href: "/collections",
  },
  {
    id: "discover-3",
    title: "Flexible messaging",
    description: "Swap in product, service, or editorial copy without reworking the design.",
    image: PLACEHOLDER_IMAGE.atlas,
    cta: "Explore",
    href: "/blog",
  },
  {
    id: "discover-4",
    title: "Neutral imagery",
    description: "Abstract placeholders keep the template clean until final assets are ready.",
    image: PLACEHOLDER_IMAGE.workspace,
    cta: "Explore",
    href: "/contact",
  },
];

export const PRODUCT_CARDS: ProductCardData[] = [
  {
    id: "prod-1",
    name: "Starter Workspace",
    category: "Workspace",
    price: "$48.00",
    rating: 4.9,
    image: PLACEHOLDER_IMAGE.aurora,
    colors: ["#e2e8f0", "#94a3b8", "#0f172a"],
    badge: "New",
  },
  {
    id: "prod-2",
    name: "Project Brief Kit",
    category: "Planning",
    price: "$52.00",
    rating: 4.8,
    image: PLACEHOLDER_IMAGE.nova,
    colors: ["#fecaca", "#fda4af", "#fb7185"],
  },
  {
    id: "prod-3",
    name: "Insight Dashboard",
    category: "Analytics",
    price: "$58.00",
    rating: 4.7,
    image: PLACEHOLDER_IMAGE.atlas,
    colors: ["#bbf7d0", "#86efac", "#22c55e"],
  },
  {
    id: "prod-4",
    name: "Operations Board",
    category: "Operations",
    price: "$74.00",
    rating: 4.6,
    image: PLACEHOLDER_IMAGE.workspace,
    colors: ["#e5e7eb", "#cbd5f5", "#6366f1"],
    badge: "Popular",
  },
  {
    id: "prod-5",
    name: "Support Playbook",
    category: "Support",
    price: "$86.00",
    rating: 4.9,
    image: PLACEHOLDER_IMAGE.hero,
    colors: ["#fef9c3", "#fde68a", "#f59e0b"],
  },
  {
    id: "prod-6",
    name: "Collaboration Canvas",
    category: "Workspace",
    price: "$44.00",
    rating: 4.5,
    image: PLACEHOLDER_IMAGE.aurora,
    colors: ["#dbeafe", "#93c5fd", "#1d4ed8"],
  },
  {
    id: "prod-7",
    name: "Roadmap Outline",
    category: "Planning",
    price: "$40.00",
    rating: 4.4,
    image: PLACEHOLDER_IMAGE.nova,
    colors: ["#fecdd3", "#f472b6", "#db2777"],
  },
  {
    id: "prod-8",
    name: "Reporting Snapshot",
    category: "Analytics",
    price: "$28.00",
    rating: 4.6,
    image: PLACEHOLDER_IMAGE.atlas,
    colors: ["#e2e8f0", "#cbd5e1", "#94a3b8"],
  },
  {
    id: "prod-9",
    name: "Workflow Bundle",
    category: "Operations",
    price: "$36.00",
    rating: 4.7,
    image: PLACEHOLDER_IMAGE.workspace,
    colors: ["#ddd6fe", "#c4b5fd", "#8b5cf6"],
    badge: "New",
  },
  {
    id: "prod-10",
    name: "Help Center Pack",
    category: "Support",
    price: "$62.00",
    rating: 4.8,
    image: PLACEHOLDER_IMAGE.hero,
    colors: ["#fee2e2", "#fecaca", "#f87171"],
  },
  {
    id: "prod-11",
    name: "Resource Library",
    category: "Workspace",
    price: "$39.00",
    rating: 4.6,
    image: PLACEHOLDER_IMAGE.aurora,
    colors: ["#fef3c7", "#fde68a", "#fbbf24"],
  },
  {
    id: "prod-12",
    name: "Checklist Archive",
    category: "Planning",
    price: "$32.00",
    rating: 4.5,
    image: PLACEHOLDER_IMAGE.atlas,
    colors: ["#e0f2fe", "#bae6fd", "#38bdf8"],
  },
];

export const FEATURE_ITEMS: FeatureItem[] = [
  {
    id: "feature-1",
    title: "Fast setup",
    subtitle: "Launch with clean defaults",
    icon: "shipping",
  },
  {
    id: "feature-2",
    title: "Flexible updates",
    subtitle: "Change copy in minutes",
    icon: "return",
  },
  {
    id: "feature-3",
    title: "Secure checkout",
    subtitle: "Protected purchase flow",
    icon: "secure",
  },
  {
    id: "feature-4",
    title: "Helpful support",
    subtitle: "Always easy to adapt",
    icon: "support",
  },
];

export const CATEGORY_TABS = [
  "Workspace",
  "Planning",
  "Analytics",
  "Operations",
  "Support",
];

export const FAVORITE_FILTERS = [
  "All",
  "Workspace",
  "Planning",
  "Analytics",
  "Operations",
  "Support",
];

export const CATEGORY_CARDS: CategoryCard[] = [
  {
    id: "cat-1",
    title: "Workspace",
    description: "Layouts, kits, and reusable starting points",
    icon: "workspace",
    href: "/collections/workspace",
  },
  {
    id: "cat-2",
    title: "Planning",
    description: "Roadmaps, briefs, and structured outlines",
    icon: "planning",
    href: "/collections/planning",
  },
  {
    id: "cat-3",
    title: "Analytics",
    description: "Dashboards, reports, and summary views",
    icon: "analytics",
    href: "/collections/analytics",
  },
  {
    id: "cat-4",
    title: "Operations",
    description: "Systems and process-ready components",
    icon: "operations",
    href: "/collections/operations",
  },
  {
    id: "cat-5",
    title: "Support",
    description: "Service flows and help resources",
    icon: "support",
    href: "/collections/support",
  },
  {
    id: "cat-6",
    title: "Resources",
    description: "Guides, references, and shared assets",
    icon: "resources",
    href: "/collections/resources",
  },
];

export const DEPARTMENTS: DepartmentCard[] = [
  {
    id: "dept-1",
    title: "Workspaces",
    subtitle: "Flexible foundations",
    image: PLACEHOLDER_IMAGE.workspace,
    href: "/collections/workspace",
  },
  {
    id: "dept-2",
    title: "Projects",
    subtitle: "Clear direction",
    image: PLACEHOLDER_IMAGE.aurora,
    href: "/collections/planning",
  },
  {
    id: "dept-3",
    title: "Insights",
    subtitle: "Useful reporting",
    image: PLACEHOLDER_IMAGE.atlas,
    href: "/collections/analytics",
  },
  {
    id: "dept-4",
    title: "Resources",
    subtitle: "Shared references",
    image: PLACEHOLDER_IMAGE.hero,
    href: "/collections/resources",
  },
];

export const BLOG_POSTS: BlogPost[] = [
  {
    id: "blog-1",
    title: "How to start with a neutral homepage",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante venenatis.",
    image: PLACEHOLDER_IMAGE.hero,
    tag: "Guide",
    date: "April 12, 2024",
    href: "/blog/graduation-dresses-style-guide",
  },
  {
    id: "blog-2",
    title: "Keeping placeholder content consistent",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed posuere consectetur est at lobortis.",
    image: PLACEHOLDER_IMAGE.workspace,
    tag: "Insight",
    date: "April 08, 2024",
    href: "/blog/eid-pieces-all-year",
  },
  {
    id: "blog-3",
    title: "Three ways to organize reusable sections",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras mattis consectetur purus sit amet fermentum.",
    image: PLACEHOLDER_IMAGE.aurora,
    tag: "Update",
    date: "April 02, 2024",
    href: "/blog/hijabi-friendly-fabrics-2024",
  },
  {
    id: "blog-4",
    title: "When to replace demo copy with real content",
    excerpt: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean lacinia bibendum nulla sed consectetur.",
    image: PLACEHOLDER_IMAGE.nova,
    tag: "Note",
    date: "March 28, 2024",
    href: "/blog/hijabi-friendly-fabrics-2025",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "test-1",
    quote:
      "The neutral defaults gave us a polished starting point without steering us toward a specific industry.",
    name: "Alex Morgan",
    role: "Operations lead",
    rating: 4.9,
    avatar: PLACEHOLDER_IMAGE.portrait1,
  },
  {
    id: "test-2",
    quote:
      "We swapped in our own copy quickly and the homepage still felt coherent from top to bottom.",
    name: "Jordan Lee",
    role: "Project manager",
    rating: 4.8,
    avatar: PLACEHOLDER_IMAGE.portrait2,
  },
  {
    id: "test-3",
    quote:
      "The placeholder visuals were neutral enough to prototype confidently before final assets were ready.",
    name: "Taylor Singh",
    role: "Marketing coordinator",
    rating: 4.7,
    avatar: PLACEHOLDER_IMAGE.portrait3,
  },
  {
    id: "test-4",
    quote:
      "It feels reusable, clean, and easy to customize without first undoing a strong niche-specific theme.",
    name: "Casey Bennett",
    role: "Product designer",
    rating: 4.8,
    avatar: PLACEHOLDER_IMAGE.portrait1,
  },
];
