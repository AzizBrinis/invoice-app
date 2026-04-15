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
    title: "Parcourir",
    links: [
      { label: "Accueil", href: "/" },
      { label: "Collections", href: "/collections" },
      { label: "Recherche", href: "/search" },
      { label: "Panier", href: "/cart" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "À propos", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "Paiement", href: "/checkout" },
    ],
  },
  {
    title: "Compte",
    links: [
      { label: "Connexion", href: "/login" },
      { label: "Créer un compte", href: "/signup" },
      { label: "Favoris", href: "/account/wishlists" },
      { label: "Commandes", href: "/account/orders" },
    ],
  },
  {
    title: "Plus",
    links: [
      { label: "Collections", href: "/collections" },
      { label: "Recherche", href: "/search" },
      { label: "Contact", href: "/contact" },
      { label: "À propos", href: "/about" },
    ],
  },
];
