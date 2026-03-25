import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import {
  canAccessAppSection,
  isClientPaymentsAccount,
  type AppSection,
} from "@/lib/authorization";
import { getSettings } from "@/server/settings";
import { SidebarNav, type NavItem } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { AssistantLauncher } from "@/components/assistant/assistant-launcher";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Espace administrateur — Application de facturation",
};

const FULL_APP_NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/tableau-de-bord",
    icon: "dashboard",
  },
  {
    label: "Devis",
    href: "/devis",
    icon: "quotes",
  },
  {
    label: "Factures",
    href: "/factures",
    icon: "invoices",
  },
  {
    label: "Produits",
    href: "/produits",
    icon: "products",
  },
  {
    label: "Site web",
    href: "/site-web",
    icon: "website",
    children: [
      { label: "Vue d’ensemble", href: "/site-web" },
      { label: "Commandes", href: "/site-web/commandes" },
      { label: "Demandes de devis", href: "/site-web/demandes-de-devis" },
      { label: "Messages de contact", href: "/site-web/messages-contact" },
      {
        label: "Personnalisation avancée",
        href: "/site-web/personnalisation-avancee",
      },
    ],
  },
  {
    label: "Clients",
    href: "/clients",
    icon: "clients",
  },
  {
    label: "Messagerie",
    href: "/messagerie",
    icon: "mail",
    children: [
      { label: "Reçus", href: "/messagerie/recus" },
      { label: "Envoyés", href: "/messagerie/envoyes" },
      { label: "Planifiés", href: "/messagerie/planifies" },
      { label: "Brouillons", href: "/messagerie/brouillons" },
      { label: "Spam", href: "/messagerie/spam" },
      { label: "Corbeille", href: "/messagerie/corbeille" },
      { label: "Nouveau message", href: "/messagerie/nouveau-message" },
      { label: "Paramètres", href: "/messagerie/parametres" },
    ],
  },
  {
    label: "Assistant AI",
    href: "/assistant",
    icon: "assistant",
  },
  {
    label: "Paramètres",
    href: "/parametres",
    icon: "settings",
  },
];

const CLIENT_PAYMENTS_NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/tableau-de-bord",
    icon: "dashboard",
  },
  {
    label: "Clients",
    href: "/clients",
    icon: "clients",
  },
  {
    label: "Services",
    href: "/services",
    icon: "products",
  },
  {
    label: "Paiements",
    href: "/paiements",
    icon: "invoices",
  },
  {
    label: "Collaborateurs du compte",
    href: "/collaborateurs",
    icon: "clients",
  },
  {
    label: "Paramètres",
    href: "/parametres",
    icon: "settings",
  },
];

const NAV_ITEM_SECTIONS: Record<string, AppSection> = {
  "/tableau-de-bord": "dashboard",
  "/services": "services",
  "/paiements": "payments",
  "/collaborateurs": "collaborators",
  "/devis": "quotes",
  "/factures": "invoices",
  "/produits": "products",
  "/site-web": "website",
  "/clients": "clients",
  "/messagerie": "messaging",
  "/assistant": "assistant",
  "/parametres": "settings",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const navSource = isClientPaymentsAccount(user)
    ? CLIENT_PAYMENTS_NAV_ITEMS
    : FULL_APP_NAV_ITEMS;
  const navItems = navSource.filter((item) =>
    canAccessAppSection(
      user,
      NAV_ITEM_SECTIONS[item.href] ?? "dashboard",
    ),
  );
  const settings = await getSettings(tenantId);
  const workspaceLabel = isClientPaymentsAccount(user)
    ? "Espace paiements clients"
    : "Espace d'administration";

  return (
    <div className="min-h-screen bg-zinc-100 transition-colors dark:bg-zinc-950 lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-screen min-w-0 lg:h-full">
        <SidebarNav items={navItems} />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:h-full lg:min-h-0 lg:overflow-hidden">
          <Topbar
            items={navItems}
            companyName={settings.companyName}
            workspaceLabel={workspaceLabel}
            user={{ name: user.name, email: user.email }}
          />
          <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-6 overflow-x-scroll min-w-0">
              {children}
            </div>
            {canAccessAppSection(user, "assistant") ? (
              <AssistantLauncher />
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
