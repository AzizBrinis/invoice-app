"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import { clsx } from "clsx";
import { RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { usePrefetchOnHover } from "@/lib/hooks/usePrefetchOnHover";
import { useWebsiteProductList } from "@/app/(app)/site-web/_hooks/useWebsiteProductList";
import type { WebsiteProductSummary } from "@/server/website";

type ProductSummaryCardProps = {
  stats: {
    totalProducts: number;
    listedProducts: number;
  };
};

const VISIBILITY_FILTERS: Array<{
  value: "all" | "visible" | "hidden";
  label: string;
}> = [
  { value: "all", label: "Tous" },
  { value: "visible", label: "Visibles" },
  { value: "hidden", label: "Masqués" },
];

export function ProductSummaryCard({ stats }: ProductSummaryCardProps) {
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">(
    "all",
  );
  const [includeInactive, setIncludeInactive] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 350);
  const listParentRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const prefetchHandlers = usePrefetchOnHover("/produits");

  const {
    items,
    meta,
    loadingPage,
    error,
    hasMore,
    loadMore,
    refresh,
    isEmpty,
    isInitialLoading,
  } = useWebsiteProductList({
    search: debouncedSearch,
    visibility,
    includeInactive,
  });

  const rows = useMemo<Array<WebsiteProductSummary | null>>(
    () => (isInitialLoading ? Array.from({ length: 6 }, () => null) : items),
    [isInitialLoading, items],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: hasMore ? rows.length + 1 : rows.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 68,
    overscan: 6,
  });

  useEffect(() => {
    if (!hasMore || !sentinelRef.current || !listParentRef.current) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      {
        root: listParentRef.current,
        rootMargin: "120px",
      },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const percentVisible = useMemo(() => {
    if (!stats.totalProducts) return 0;
    return Math.round(
      (stats.listedProducts / stats.totalProducts) * 100,
    );
  }, [stats.listedProducts, stats.totalProducts]);

  return (
    <div className="card space-y-5 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Visibilité des produits
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {stats.listedProducts} / {stats.totalProducts} produit
            {stats.totalProducts > 1 ? "s" : ""} visibles ({percentVisible}%).
          </p>
          {meta?.filteredTotal != null && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Résultats filtrés : {meta.filteredTotal}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="self-start px-3 py-2 text-sm"
          onClick={refresh}
          loading={loadingPage === 1}
        >
          <RefreshCcw className="h-4 w-4" />
          Rafraîchir
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
            Recherche
            <span className="sr-only"> sur les produits</span>
            <span className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
              <Search className="h-4 w-4 text-zinc-500" />
              <Input
                className="h-10 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                placeholder="Nom, SKU ou catégorie"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Rechercher un produit"
              />
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {VISIBILITY_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                variant={filter.value === visibility ? "primary" : "ghost"}
                onClick={() => setVisibility(filter.value)}
                className="px-3 py-2 text-xs font-semibold"
                aria-pressed={filter.value === visibility}
              >
                {filter.label}
              </Button>
            ))}
            <label className="ml-auto flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
              <input
                type="checkbox"
                className="checkbox"
                checked={includeInactive}
                onChange={(event) => setIncludeInactive(event.target.checked)}
                aria-label="Inclure les produits inactifs"
              />
              Inactifs
            </label>
          </div>
        </div>
      </div>

      {error ? <Alert variant="error" title={error} /> : null}

      <div
        ref={listParentRef}
        className="max-h-[420px] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950/50"
        aria-busy={Boolean(loadingPage)}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const product = rows[virtualRow.index];
            const isLoaderRow = virtualRow.index >= rows.length;
            return (
              <div
                key={virtualRow.key}
                className="absolute left-0 right-0 px-2"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                ref={virtualizer.measureElement}
              >
                {isLoaderRow ? (
                  <div
                    ref={sentinelRef}
                    className="flex h-16 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
                  >
                    {hasMore
                      ? "Défilez pour charger les produits suivants…"
                      : "Tous les produits ont été chargés."}
                  </div>
                ) : isInitialLoading ? (
                  <div className="my-2 h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                ) : (
                  <div className="my-2 flex items-start justify-between rounded-lg border border-zinc-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {product?.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {product?.sku ?? "SKU inconnu"} ·{" "}
                        {product?.category ?? "Sans catégorie"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs">
                      <span
                        className={clsx(
                          "badge",
                          product?.isListedInCatalog
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                        )}
                      >
                        {product?.isListedInCatalog ? "Visible" : "Masqué"}
                      </span>
                      {!product?.isActive ? (
                        <span className="badge bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200">
                          Inactif
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {isEmpty && !loadingPage ? (
            <p className="absolute left-0 right-0 top-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Aucun produit ne correspond aux filtres sélectionnés.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          {!meta
            ? "Chargement en cours…"
            : `Affichage de ${items.length} / ${
              meta.filteredTotal ?? items.length
            } résultats`}
        </p>
        <Button asChild variant="secondary" className="px-3 py-2 text-xs font-semibold">
          <Link href="/produits" {...prefetchHandlers}>
            Aller vers Produits
          </Link>
        </Button>
      </div>
    </div>
  );
}
