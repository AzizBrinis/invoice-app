import { clsx } from "clsx";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { listProducts } from "@/server/products";
import {
  deleteProductAction,
  importProductsAction,
} from "@/app/(app)/produits/actions";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/export-button";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Alert } from "@/components/ui/alert";
import {
  FlashMessages,
  type FlashMessage,
} from "@/components/ui/flash-messages";

export const dynamic = "force-dynamic";

function parseBooleanFilter(value: string | undefined): boolean | "all" {
  if (!value || value === "all") return "all";
  if (value === "actifs") return true;
  if (value === "inactifs") return false;
  return "all";
}

type SearchParams = Record<string, string | string[] | undefined>;

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

export default async function ProduitsPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = isPromise<SearchParams>(searchParams)
    ? await searchParams
    : searchParams;

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

  const user = await requireUser();
  const [products, categories, settings] = await Promise.all([
    listProducts({
      search: search || undefined,
      category: categorieParam,
      isActive,
      page,
    }),
    prisma.product.findMany({
      where: { userId: user.id, category: { not: null } },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
    }),
    getSettings(user.id),
  ]);

  const categoryOptions = [
    "all",
    ...categories
      .map((item) => item.category)
      .filter((value): value is string => Boolean(value)),
  ];
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

      <form className="card grid gap-4 p-4 sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="recherche">
            Recherche
          </label>
          <input
            className="input"
            type="search"
            id="recherche"
            name="recherche"
            defaultValue={search}
            placeholder="Nom, SKU, catégorie..."
          />
        </div>
        <div>
          <label className="label" htmlFor="categorie">
            Catégorie
          </label>
          <select
            id="categorie"
            name="categorie"
            className="input"
            defaultValue={categorieParam}
          >
            {categoryOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Toutes" : option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="statut">
            Statut
          </label>
          <select
            id="statut"
            name="statut"
            className="input"
            defaultValue={statutParam ?? "all"}
          >
            <option value="all">Tous</option>
            <option value="actifs">Actifs</option>
            <option value="inactifs">Inactifs</option>
          </select>
        </div>
        <Button type="submit" variant="secondary" className="sm:col-span-4 sm:w-fit">
          Filtrer
        </Button>
      </form>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3 text-left">Produit</th>
              <th className="px-4 py-3 text-left">Catégorie</th>
              <th className="px-4 py-3 text-right">Prix HT</th>
              <th className="px-4 py-3 text-right">Prix TTC</th>
              <th className="px-4 py-3 text-left">TVA</th>
              <th className="px-4 py-3 text-left">Remise</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {products.items.map((product) => (
              <tr
                key={product.id}
                className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">{product.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">SKU : {product.sku}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {product.category ?? "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                  {formatCurrency(fromCents(product.priceHTCents, currencyCode), currencyCode)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-800 dark:text-zinc-100">
                  {formatCurrency(fromCents(product.priceTTCCents, currencyCode), currencyCode)}
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{product.vatRate}%</td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                  {product.defaultDiscountRate != null
                    ? `${product.defaultDiscountRate}%`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
                      product.isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                    )}
                  >
                    {product.isActive ? "Actif" : "Inactif"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="secondary" className="px-2 py-1 text-xs">
                      <Link href={`/produits/${product.id}/modifier`}>Modifier</Link>
                    </Button>
                    <form action={deleteProductAction.bind(null, product.id)}>
                      <FormSubmitButton
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Supprimer
                      </FormSubmitButton>
                      <input type="hidden" name="redirectTo" value={redirectBase} />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  Aucun produit trouvé avec ces critères.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {products.pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <ProductPaginationLink
            page={products.page - 1}
            disabled={products.page <= 1}
            search={search}
            statut={statutParam ?? "all"}
            categorie={categorieParam}
          >
            Précédent
          </ProductPaginationLink>
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            Page {products.page} / {products.pageCount}
          </span>
          <ProductPaginationLink
            page={products.page + 1}
            disabled={products.page >= products.pageCount}
            search={search}
            statut={statutParam ?? "all"}
            categorie={categorieParam}
          >
            Suivant
          </ProductPaginationLink>
        </div>
      )}
    </div>
  );
}

function ProductPaginationLink({
  page,
  disabled,
  search,
  statut,
  categorie,
  children,
}: {
  page: number;
  disabled: boolean;
  search: string;
  statut: string;
  categorie: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        {children}
      </span>
    );
  }

  const params = new URLSearchParams();
  if (search) params.set("recherche", search);
  if (statut) params.set("statut", statut);
  if (categorie) params.set("categorie", categorie);
  params.set("page", String(page));

  return (
    <Link
      href={`/produits?${params.toString()}`}
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}
