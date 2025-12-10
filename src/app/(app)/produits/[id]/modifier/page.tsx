import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ProductForm } from "@/app/(app)/produits/product-form";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

export const dynamic = "force-dynamic";

type PageParams = { id: string };
type EditProduitPageProps = { params: Promise<PageParams> };

export default async function EditProduitPage({
  params,
}: EditProduitPageProps) {
  const resolvedParams = await params;
  const user = await requireUser();
  const [product, settings] = await Promise.all([
    prisma.product.findFirst({
      where: { id: resolvedParams.id, userId: user.id },
    }),
    getSettings(user.id),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Modifier le produit
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Ajustez les tarifs, catégories et remises par défaut.
          </p>
        </div>
        <Link
          href="/produits"
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          Retour à la liste
        </Link>
      </div>
      <ProductForm
        submitLabel="Enregistrer"
        currencyCode={settings.defaultCurrency as CurrencyCode}
        defaultValues={product}
        redirectTo="/produits"
      />
    </div>
  );
}
