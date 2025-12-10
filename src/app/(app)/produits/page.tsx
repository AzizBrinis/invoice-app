import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  listProducts,
  listProductCategories,
} from "@/server/products";
import { importProductsAction } from "@/app/(app)/produits/actions";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";
import { ProductsPageSkeleton } from "@/components/skeletons";
import { ProductsInteractiveShell } from "@/app/(app)/produits/products-interactive-shell";

export const dynamic = "force-dynamic";

function parseBooleanFilter(value: string | undefined): boolean | "all" {
  if (!value || value === "all") return "all";
  if (value === "actifs") return true;
  if (value === "inactifs") return false;
  return "all";
}

type SearchParams = Record<string, string | string[] | undefined>;
type ProduitsPageProps = { searchParams?: Promise<SearchParams> };

export default async function ProduitsPage({
  searchParams,
}: ProduitsPageProps) {
  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ProduitsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ProduitsPageContent({
  searchParams,
}: ProduitsPageProps) {
  const resolvedSearchParams: SearchParams = (await searchParams) ?? {};

  const search = Array.isArray(resolvedSearchParams?.recherche)
    ? resolvedSearchParams.recherche[0]
    : resolvedSearchParams?.recherche ?? "";
  const categorieParam = Array.isArray(resolvedSearchParams?.categorie)
    ? resolvedSearchParams.categorie[0]
    : (resolvedSearchParams?.categorie as string | undefined) ?? "all";
  const statutParam = Array.isArray(resolvedSearchParams?.statut)
    ? resolvedSearchParams.statut[0]
    : (resolvedSearchParams?.statut as string | undefined);
  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams.page[0]
    : resolvedSearchParams?.page;
  const errorMessage = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams?.error ?? null;

  const page = Number(pageParam ?? "1") || 1;
  const isActive = parseBooleanFilter(statutParam);
  const statutValue =
    isActive === "all"
      ? "all"
      : isActive
        ? "actifs"
        : "inactifs";

  const user = await requireUser();
  const [products, categoriesRaw, settings] = await Promise.all([
    listProducts(
      {
        search: search || undefined,
        category: categorieParam,
        isActive,
        page,
        pageSize: 25,
      },
      user.id,
    ),
    listProductCategories(user.id),
    getSettings(user.id),
  ]);

  const categoryOptions = ["all", ...categoriesRaw];
  const currencyCode = settings.defaultCurrency as CurrencyCode;
  const successMessage = Array.isArray(resolvedSearchParams?.message)
    ? resolvedSearchParams.message[0]
    : resolvedSearchParams?.message ?? null;
  const warningMessage = Array.isArray(resolvedSearchParams?.warning)
    ? resolvedSearchParams.warning[0]
    : resolvedSearchParams?.warning ?? null;
  const flashParam = Array.isArray(resolvedSearchParams?.flash)
    ? resolvedSearchParams.flash[0]
    : resolvedSearchParams?.flash ?? null;

  const flashMessages: FlashMessage[] = [];
  if (successMessage) {
    flashMessages.push({
      id: flashParam ? `${flashParam}:success` : undefined,
      variant: "success",
      title: successMessage,
    });
  }
  if (warningMessage) {
    flashMessages.push({
      id: flashParam ? `${flashParam}:warning` : undefined,
      variant: "warning",
      title: warningMessage,
    });
  }
  if (errorMessage) {
    flashMessages.push({
      id: flashParam ? `${flashParam}:error` : undefined,
      variant: "error",
      title: errorMessage,
    });
  }

  const searchQuery = new URLSearchParams();
  if (search) searchQuery.set("recherche", search);
  if (categorieParam && categorieParam !== "all") {
    searchQuery.set("categorie", categorieParam);
  }
  if (statutParam) searchQuery.set("statut", statutParam);
  if (page > 1) searchQuery.set("page", String(page));
  const redirectBase = searchQuery.toString()
    ? `/produits?${searchQuery.toString()}`
    : "/produits";

  return (
    <div className="space-y-6">
      <FlashMessages messages={flashMessages} />
      {successMessage ? <Alert variant="success" title={successMessage} /> : null}
      {warningMessage ? <Alert variant="warning" title={warningMessage} /> : null}
      {errorMessage ? <Alert variant="error" title={errorMessage} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Produits & services</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Cataloguez vos prestations, prix HT/TTC et taux de TVA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            variant="ghost"
            className="text-sm text-blue-600 dark:text-blue-400"
            href="/api/export/produits"
            loadingText="Export…"
          >
            Export CSV
          </ExportButton>
          <Button asChild>
            <Link href="/produits/nouveau">Nouveau produit</Link>
          </Button>
        </div>
      </div>

      <form
        action={importProductsAction}
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="file" className="label">
            Import CSV (colonnes : sku, nom, prix HT, TVA, etc.)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            required
            className="input border-2 border-dashed"
          />
        </div>
        <FormSubmitButton variant="secondary">
          Importer
        </FormSubmitButton>
        <input type="hidden" name="redirectTo" value={redirectBase} />
      </form>

      <ProductsInteractiveShell
        initialData={products}
        initialSearch={search}
        initialCategory={categorieParam}
        initialStatus={statutValue}
        categories={categoryOptions}
        currencyCode={currencyCode}
      />
    </div>
  );
}
