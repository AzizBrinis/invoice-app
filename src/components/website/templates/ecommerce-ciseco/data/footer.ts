export const BUILDER_FOOTER_SHORTCUT_ICONS = [
  "home",
  "collections",
  "search",
  "contact",
  "about",
  "blog",
  "cart",
  "account",
] as const;

export const FOOTER_SHORTCUT_ICON_OPTIONS = [
  { value: "home", label: "Accueil" },
  { value: "collections", label: "Collections" },
  { value: "search", label: "Recherche" },
  { value: "contact", label: "Contact" },
  { value: "about", label: "À propos" },
  { value: "blog", label: "Blog" },
  { value: "cart", label: "Panier" },
  { value: "account", label: "Compte" },
] as const;

export const DEFAULT_FOOTER_DESCRIPTION =
  "Une base claire et flexible pour un catalogue, un site de services ou un site éditorial.";

export const DEFAULT_FOOTER_CMS_TITLE = "Informations";

export const DEFAULT_FOOTER_BOTTOM_TEXT =
  "{{companyName}}. Tous droits réservés.";

export const DEFAULT_FOOTER_SHORTCUTS = [
  {
    label: "À propos",
    href: "/about",
    icon: "about",
  },
  {
    label: "Blog",
    href: "/blog",
    icon: "blog",
  },
  {
    label: "Contact",
    href: "/contact",
    icon: "contact",
  },
] as const;
