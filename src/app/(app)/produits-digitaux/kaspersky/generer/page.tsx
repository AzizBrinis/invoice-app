import { randomUUID } from "node:crypto";
import { requireAppSectionAccess } from "@/lib/authorization";
import { isKasperskySku, KASPERSKY_VARIANTS } from "@/lib/digital-products/kaspersky-catalog";
import { getKasperskyInventory } from "@/server/digital-products/licences";
import { firstParam, SectionHeader } from "../../_components/ui";
import { GenerateLicenceForm } from "./generate-licence-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function GenerateLicencePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const params = (await searchParams) ?? {};
  const skuParam = firstParam(params.sku);

  const inventory = await getKasperskyInventory(tenantId);
  const available = Object.fromEntries(inventory.map((row) => [row.variant.sku, row.counts.AVAILABLE]));
  const firstInStock = inventory.find((row) => row.counts.AVAILABLE > 0)?.variant.sku;
  const defaultSku = isKasperskySku(skuParam) ? skuParam : (firstInStock ?? KASPERSKY_VARIANTS[0].sku);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Kaspersky"
        title="Générer une licence"
        description="Choisissez la variante et la quantité : les codes inutilisés sont attribués automatiquement, puis la carte d’activation A4 est générée en PDF."
      />
      {/* A fresh token per page load makes double submissions idempotent. */}
      <GenerateLicenceForm formToken={randomUUID()} defaultSku={defaultSku} available={available} />
    </div>
  );
}
