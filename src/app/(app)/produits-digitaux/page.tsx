import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Download, KeyRound, MonitorCheck, ShieldCheck } from "lucide-react";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Button } from "@/components/ui/button";
import {
  DIGITAL_PRODUCT_FAMILIES,
  DIGITAL_PRODUCT_FAMILY_IDS,
  type DigitalProductFamilyId,
} from "@/lib/digital-products/catalog";
import { getDigitalProductInventory } from "@/server/digital-products/licences";
import { SectionHeader } from "./_components/ui";

const FAMILY_ICONS: Record<DigitalProductFamilyId, { icon: typeof ShieldCheck; tone: string }> = {
  kaspersky: {
    icon: ShieldCheck,
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  windows: {
    icon: MonitorCheck,
    tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  idm: {
    icon: Download,
    tone: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
};

export const dynamic = "force-dynamic";

export default async function DigitalProductsOverviewPage() {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const families = await Promise.all(
    DIGITAL_PRODUCT_FAMILY_IDS.map(async (id) => {
      const inventory = await getDigitalProductInventory(tenantId, id);
      const totals = inventory.reduce(
        (acc, row) => ({
          available: acc.available + row.counts.AVAILABLE,
          reserved: acc.reserved + row.counts.RESERVED,
          used: acc.used + row.counts.USED,
        }),
        { available: 0, reserved: 0, used: 0 },
      );
      return { family: DIGITAL_PRODUCT_FAMILIES[id], totals };
    }),
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Produits Digitaux"
        title="Licences et produits numériques"
        description="Gérez votre stock de codes d’activation, générez les cartes de licence PDF et préparez la livraison automatique des commandes de la boutique."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {families.map(({ family, totals }) => {
          const { icon: Icon, tone: iconTone } = FAMILY_ICONS[family.id];
          return (
            <article key={family.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${iconTone}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{family.name}</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    {family.summary}
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
                {[
                  ["Disponibles", totals.available, "text-emerald-600 dark:text-emerald-400"],
                  ["Réservés", totals.reserved, "text-amber-600 dark:text-amber-400"],
                  ["Utilisés", totals.used, "text-zinc-700 dark:text-zinc-200"],
                ].map(([label, value, tone]) => (
                  <div key={label as string} className="rounded-lg bg-zinc-50 px-2 py-3 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className={`text-xl font-semibold tabular-nums ${tone}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button asChild className="w-full sm:w-auto">
                  <Link href={family.basePath as Route}>
                    Ouvrir le tableau de bord <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full sm:w-auto">
                  <Link href={`${family.basePath}/generer` as Route}>Générer une licence</Link>
                </Button>
              </div>
            </article>
          );
        })}

        <article className="card flex flex-col justify-between border-dashed p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Livraison automatique</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                Prochaine étape : réception des commandes PrestaShop, envoi des licences et des factures par
                e-mail, confirmation de livraison à la boutique.
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            L’API sécurisée de génération de licences est déjà disponible pour l’intégration.
          </p>
        </article>
      </div>
    </div>
  );
}
