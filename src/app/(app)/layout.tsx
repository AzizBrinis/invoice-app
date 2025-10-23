import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/server/settings";
import {
  SidebarNav,
  type NavItem,
} from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";

export const metadata: Metadata = {
  title: "Espace administrateur — Application de facturation",
};

const NAV_ITEMS: NavItem[] = [
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
    label: "Clients",
    href: "/clients",
    icon: "clients",
  },
  {
    label: "Paramètres",
    href: "/parametres",
    icon: "settings",
  },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const settings = await getSettings();

  return (
    <div className="min-h-screen bg-zinc-100">
      <div className="flex min-h-screen">
        <SidebarNav items={NAV_ITEMS} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar
            items={NAV_ITEMS}
            companyName={settings.companyName}
            user={{ name: user.name, email: user.email }}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
