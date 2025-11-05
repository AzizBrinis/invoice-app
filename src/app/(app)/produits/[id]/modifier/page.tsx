import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { ProductForm } from "@/app/(app)/produits/product-form";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

export const dynamic = "force-dynamic";

type PageParams = { id: string };

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export default async function EditProduitPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const resolvedParams = isPromise<PageParams>(params) ? await params : params;
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
      <div className="flex items-center justify-between">
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
          className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
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
