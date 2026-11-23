import { randomUUID } from "node:crypto";
import { requireAppSectionAccess } from "@/lib/authorization";
import {
  getDigitalProductFamily,
  isFamilySku,
  type DigitalProductFamilyId,
} from "@/lib/digital-products/catalog";
import { getDigitalProductInventory } from "@/server/digital-products/licences";
import { firstParam, SectionHeader } from "./ui";
import { GenerateLicenceForm } from "./generate-licence-form";

type SearchParams = Record<string, string | string[] | undefined>;

/** Manual licence generation for one product family. */
export async function FamilyGeneratePage({
  familyId,
  searchParams,
}: {
  familyId: DigitalProductFamilyId;
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });
  const tenantId = user.activeTenantId ?? user.tenantId ?? user.id;
  const params = (await searchParams) ?? {};
  const skuParam = firstParam(params.sku);
  const family = getDigitalProductFamily(familyId);

  const inventory = await getDigitalProductInventory(tenantId, familyId);
  const available = Object.fromEntries(inventory.map((row) => [row.variant.sku, row.counts.AVAILABLE]));
  const firstInStock = inventory.find((row) => row.counts.AVAILABLE > 0)?.variant.sku;
  const defaultSku = isFamilySku(family, skuParam) ? skuParam : (firstInStock ?? family.variants[0].sku);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={family.name}
        title="Générer une licence"
        description={`Choisissez la variante et la quantité : les codes inutilisés sont attribués automatiquement, puis le ${family.documentLabel} est généré en PDF.`}
      />
      {/* A fresh token per page load makes double submissions idempotent. */}
      <GenerateLicenceForm
        familyId={family.id}
        formToken={randomUUID()}
        defaultSku={defaultSku}
        available={available}
      />
    </div>
  );
}
