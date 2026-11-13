import type { ReactNode } from "react";
import { requireAppSectionAccess } from "@/lib/authorization";
import { Alert } from "@/components/ui/alert";
import { isLicenceEncryptionConfigured } from "@/server/digital-products/licence-crypto";
import { isDigitalLicenceSchemaReady } from "@/server/digital-products/store";

export const dynamic = "force-dynamic";

export default async function DigitalProductsLayout({ children }: { children: ReactNode }) {
  // Administrators only (see canManageDigitalProducts).
  await requireAppSectionAccess("digitalProducts", { redirectOnFailure: true });

  const [schemaReady, encryptionReady] = await Promise.all([
    isDigitalLicenceSchemaReady().catch(() => false),
    Promise.resolve(isLicenceEncryptionConfigured()),
  ]);

  if (!schemaReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Produits Digitaux</h1>
        <Alert
          variant="warning"
          title="Base de données non initialisée"
          description="Appliquez la migration scripts/sql/20261110_digital_licences.sql pour activer la gestion des licences."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!encryptionReady ? (
        <Alert
          variant="error"
          title="Clé de chiffrement manquante"
          description="Définissez DIGITAL_LICENCE_ENCRYPTION_KEY (32 octets en base64) : l’ajout de codes et la génération de licences sont bloqués tant qu’elle est absente."
        />
      ) : null}
      {children}
    </div>
  );
}
