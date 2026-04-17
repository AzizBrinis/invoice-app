export const CISECO_PAGE_DEFINITIONS = [
  { key: "home", label: "Accueil", path: "/" },
  { key: "about", label: "À propos", path: "/about" },
  { key: "contact", label: "Contact", path: "/contact" },
  { key: "blog", label: "Blog", path: "/blog" },
  {
    key: "blog-detail",
    label: "Article de blog",
    path: "/blog/graduation-dresses-style-guide",
  },
  { key: "search", label: "Recherche", path: "/search" },
  { key: "collections", label: "Collections", path: "/collections" },
  { key: "product", label: "Produit", path: "/produit/produit-demo" },
  { key: "cart", label: "Panier", path: "/cart" },
  { key: "checkout", label: "Paiement", path: "/checkout" },
  { key: "order-success", label: "Confirmation", path: "/order-success" },
  { key: "login", label: "Connexion", path: "/login" },
  { key: "signup", label: "Inscription", path: "/signup" },
  { key: "forgot-password", label: "Mot de passe oublié", path: "/forgot-password" },
  { key: "account", label: "Mon compte", path: "/account" },
  { key: "account-wishlists", label: "Favoris", path: "/account/wishlists" },
  {
    key: "account-orders-history",
    label: "Historique commandes",
    path: "/account/orders",
  },
  {
    key: "account-order-detail",
    label: "Détail commande",
    path: "/account/orders/commande-demo",
  },
  {
    key: "account-billing",
    label: "Facturation",
    path: "/account/billing",
  },
  {
    key: "account-change-password",
    label: "Changer le mot de passe",
    path: "/account/change-password",
  },
] as const;

export type CisecoPageKey = (typeof CISECO_PAGE_DEFINITIONS)[number]["key"];

export function getCisecoPageDefinition(key: CisecoPageKey) {
  return CISECO_PAGE_DEFINITIONS.find((entry) => entry.key === key);
}

export function resolveCisecoPageKey(
  value?: string | null,
): CisecoPageKey | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return CISECO_PAGE_DEFINITIONS.some((entry) => entry.key === trimmed)
    ? (trimmed as CisecoPageKey)
    : null;
}
