import type { FooterLinkGroup, NavItem } from "../types";

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Collections", href: "/collections" },
  { label: "About Us", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const HERO_BADGES = [
  "Reusable sections",
  "Neutral visuals",
  "Fast setup",
];

export const FOOTER_LINKS: FooterLinkGroup[] = [
  {
    title: "Browse",
    links: [
      { label: "Home", href: "/" },
      { label: "Collections", href: "/collections" },
      { label: "Search", href: "/search" },
      { label: "Cart", href: "/cart" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "Checkout", href: "/checkout" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign In", href: "/login" },
      { label: "Create Account", href: "/signup" },
      { label: "Wishlists", href: "/account/wishlists" },
      { label: "Orders", href: "/account/orders" },
    ],
  },
  {
    title: "More",
    links: [
      { label: "Collections", href: "/collections" },
      { label: "Search", href: "/search" },
      { label: "Contact", href: "/contact" },
      { label: "About Us", href: "/about" },
    ],
  },
];
