import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { listProducts } from "@/server/products";
import {
  deleteProductAction,
  importProductsAction,
} from "@/app/(app)/produits/actions";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import { getSettings } from "@/server/settings";
import type { CurrencyCode } from "@/lib/currency";

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

  const page = Number(pageParam ?? "1") || 1;
  const isActive = parseBooleanFilter(statutParam);

  const [products, categories, settings] = await Promise.all([
    listProducts({
      search: search || undefined,
      category: categorieParam,
      isActive,
      page,
    }),
    prisma.product.findMany({
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
      where: { category: { not: null } },
    }),
    getSettings(),
  ]);

  const categoryOptions = [
    "all",
    ...categories
      .map((item) => item.category)
      .filter((value): value is string => Boolean(value)),
  ];
  const currencyCode = settings.defaultCurrency as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Produits & services</h1>
          <p className="text-sm text-zinc-600">
            Cataloguez vos prestations, prix HT/TTC et taux de TVA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" className="text-sm text-blue-600">
            <Link href="/api/export/produits" target="_blank">
              Export CSV
            </Link>
          </Button>
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
          <label htmlFor="file" className="text-sm font-medium text-zinc-700">
            Import CSV (colonnes : sku, nom, prix HT, TVA, etc.)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv"
            required
            className="rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary">
          Importer
        </Button>
      </form>

      <form className="card grid gap-4 p-4 sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium text-zinc-700" htmlFor="recherche">
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
          <label className="text-sm font-medium text-zinc-700" htmlFor="categorie">
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
          <label className="text-sm font-medium text-zinc-700" htmlFor="statut">
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
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
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
          <tbody className="divide-y divide-zinc-100">
            {products.items.map((product) => (
              <tr key={product.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{product.name}</div>
                  <div className="text-xs text-zinc-500">SKU : {product.sku}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {product.category ?? "—"}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {formatCurrency(fromCents(product.priceHTCents), currencyCode)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-800">
                  {formatCurrency(fromCents(product.priceTTCCents), currencyCode)}
                </td>
                <td className="px-4 py-3 text-zinc-600">{product.vatRate}%</td>
                <td className="px-4 py-3 text-zinc-600">
                  {product.defaultDiscountRate != null
                    ? `${product.defaultDiscountRate}%`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}
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
                      <Button
                        type="submit"
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700"
                      >
                        Supprimer
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {products.items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-zinc-500">
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
          <span className="text-sm text-zinc-600">
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
      <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-400">
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
      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
    >
      {children}
    </Link>
  );
}
