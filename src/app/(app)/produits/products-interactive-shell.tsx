"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { fromCents } from "@/lib/money";
import type { CurrencyCode } from "@/lib/currency";
import type { ProductListResult } from "@/server/products";
import { deleteProductInlineAction } from "@/app/(app)/produits/actions";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type ProductsInteractiveShellProps = {
  initialData: ProductListResult;
  initialSearch: string;
  initialCategory: string;
  initialStatus: "all" | "actifs" | "inactifs";
  categories: string[];
  currencyCode: CurrencyCode;
};

type NormalizedFilters = {
  search: string;
  category: string;
  status: "all" | "actifs" | "inactifs";
};

type CacheEntry = {
  data?: ProductListResult;
  timestamp?: number;
  promise?: Promise<ProductListResult>;
};

const REQUEST_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL = 30_000;
const STALE_TTL = 120_000;
const ROW_HEIGHT = 72;
const VIRTUALIZATION_THRESHOLD = 40;
const OVERSCAN = 6;

function buildCacheKey(filters: NormalizedFilters, page: number) {
  return JSON.stringify({ ...filters, page });
}

function buildQueryParams(filters: NormalizedFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("recherche", filters.search);
  if (filters.category && filters.category !== "all") {
    params.set("categorie", filters.category);
  }
  if (filters.status !== "all") {
    params.set("statut", filters.status);
  }
  params.set("page", String(page));
  params.set("pageSize", "25");
  return params.toString();
}

async function fetchProductsPage(
  filters: NormalizedFilters,
  page: number,
) {
  const params = buildQueryParams(filters, page);
  const response = await fetch(`/api/produits?${params}`, {
    cache: "no-store",
    method: "GET",
    headers: {
      "accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error("Erreur de chargement des produits");
  }
  return (await response.json()) as ProductListResult;
}

async function fetchWithCache(
  filters: NormalizedFilters,
  page: number,
) {
  const key = buildCacheKey(filters, page);
  const now = Date.now();
  const entry = REQUEST_CACHE.get(key);

  if (entry?.data && entry.timestamp) {
    const age = now - entry.timestamp;
    if (age <= CACHE_TTL) {
      return entry.data;
    }
    if (!entry.promise) {
      entry.promise = fetchProductsPage(filters, page).then((data) => {
        REQUEST_CACHE.set(key, {
          data,
          timestamp: Date.now(),
        });
        return data;
      });
    }
    if (age <= STALE_TTL) {
      entry.promise.catch(() => {
        REQUEST_CACHE.delete(key);
      });
      return entry.data;
    }
    return entry.promise;
  }

  if (entry?.promise) {
    return entry.promise;
  }

  const pending = fetchProductsPage(filters, page).then((data) => {
    REQUEST_CACHE.set(key, {
      data,
      timestamp: Date.now(),
    });
    return data;
  });
  REQUEST_CACHE.set(key, { promise: pending });
  return pending;
}

export function ProductsInteractiveShell({
  initialData,
  initialSearch,
  initialCategory,
  initialStatus,
  categories,
  currencyCode,
}: ProductsInteractiveShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState<"all" | "actifs" | "inactifs">(
    initialStatus,
  );
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const normalizedFilters = useMemo<NormalizedFilters>(
    () => ({
      search: debouncedSearch.trim(),
      category,
      status,
    }),
    [debouncedSearch, category, status],
  );
  const filtersKey = useMemo(
    () => JSON.stringify(normalizedFilters),
    [normalizedFilters],
  );

  const [pages, setPages] = useState<Map<number, ProductListResult>>(
    () => new Map([[initialData.page, initialData]]),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingPages, setLoadingPages] = useState<Set<number>>(
    () => new Set(),
  );
  const loadingPagesRef = useRef(loadingPages);
  useEffect(() => {
    loadingPagesRef.current = loadingPages;
  }, [loadingPages]);

  const [scrollMetrics, setScrollMetrics] = useState({
    top: 0,
    height: 400,
  });
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const prefetchedIds = useRef(new Set<string>());
  const isInitialRender = useRef(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isPendingDelete, startDeleteTransition] = useTransition();

  const sortedPages = useMemo(
    () =>
      Array.from(pages.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value),
    [pages],
  );
  const mergedItems = useMemo(
    () => sortedPages.flatMap((entry) => entry.items),
    [sortedPages],
  );
  const latestMeta = sortedPages.at(-1) ?? initialData;
  const hasNextPage = latestMeta.page < latestMeta.pageCount;

  useEffect(() => {
    const params = new URLSearchParams();
    if (normalizedFilters.search) {
      params.set("recherche", normalizedFilters.search);
    }
    if (normalizedFilters.category !== "all") {
      params.set("categorie", normalizedFilters.category);
    }
    if (normalizedFilters.status !== "all") {
      params.set("statut", normalizedFilters.status);
    }
    const next = params.toString();
    const target = (next ? `${pathname}?${next}` : pathname) as Route;
    router.replace(target, {
      scroll: false,
    });
  }, [normalizedFilters, pathname, router]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    let cancelled = false;
    setIsRefreshing(true);
    fetchWithCache(normalizedFilters, 1)
      .then((data) => {
        if (cancelled) return;
        setPages(new Map([[1, data]]));
        setInlineError(null);
        setInlineMessage(null);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setInlineError(
          "Impossible de rafraîchir la liste des produits. Réessayez.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filtersKey, normalizedFilters]);

  const loadPage = useCallback(
    async (page: number) => {
      if (loadingPagesRef.current.has(page)) {
        return;
      }
      setLoadingPages((prev) => {
        const next = new Set(prev);
        next.add(page);
        return next;
      });
      try {
        const data = await fetchWithCache(normalizedFilters, page);
        setPages((prev) => {
          const next = new Map(prev);
          next.set(page, data);
          return next;
        });
      } catch (error) {
        console.error(error);
        setInlineError("Erreur lors du chargement supplémentaire.");
      } finally {
        setLoadingPages((prev) => {
          const next = new Set(prev);
          next.delete(page);
          return next;
        });
      }
    },
    [normalizedFilters],
  );

  const handleLoadMore = useCallback(() => {
    if (!hasNextPage) {
      return;
    }
    loadPage(latestMeta.page + 1);
  }, [hasNextPage, latestMeta.page, loadPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }
    const handleScroll = () => {
      setScrollMetrics((prev) => ({
        ...prev,
        top: container.scrollTop,
        height: container.clientHeight,
      }));
      if (
        hasNextPage &&
        container.scrollHeight - (container.scrollTop + container.clientHeight) <
          160 &&
        !loadingPagesRef.current.has(latestMeta.page + 1)
      ) {
        loadPage(latestMeta.page + 1);
      }
    };
    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      setScrollMetrics((prev) => ({
        ...prev,
        height: entry.contentRect.height,
      }));
    });
    resizeObserver.observe(container);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [hasNextPage, latestMeta.page, loadPage]);

  useEffect(() => {
    if (!inlineMessage) {
      return;
    }
    const timeout = setTimeout(() => setInlineMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [inlineMessage]);

  const virtualizationEnabled =
    mergedItems.length > VIRTUALIZATION_THRESHOLD;
  const startIndex = virtualizationEnabled
    ? Math.max(
        0,
        Math.floor(scrollMetrics.top / ROW_HEIGHT) - OVERSCAN,
      )
    : 0;
  const visibleCount = virtualizationEnabled
    ? Math.ceil(scrollMetrics.height / ROW_HEIGHT) + OVERSCAN * 2
    : mergedItems.length;
  const endIndex = virtualizationEnabled
    ? Math.min(mergedItems.length, startIndex + visibleCount)
    : mergedItems.length;
  const visibleItems = mergedItems.slice(startIndex, endIndex);
  const topSpacerHeight = virtualizationEnabled
    ? startIndex * ROW_HEIGHT
    : 0;
  const bottomSpacerHeight = virtualizationEnabled
    ? Math.max(0, mergedItems.length - endIndex) * ROW_HEIGHT
    : 0;

  const handlePrefetch = useCallback(
    (productId: string) => {
      if (prefetchedIds.current.has(productId)) {
        return;
      }
      prefetchedIds.current.add(productId);
      const target = `/produits/${productId}/modifier` as Route;
      try {
        router.prefetch(target);
      } catch {
        prefetchedIds.current.delete(productId);
      }
    },
    [router],
  );

  const handleDelete = useCallback(
    (productId: string) => {
      setPendingDeleteId(productId);
      startDeleteTransition(() => {
        deleteProductInlineAction(productId)
          .then((result) => {
            if (!result?.success) {
              setInlineError(
                result?.error ??
                  "Impossible de supprimer ce produit pour le moment.",
              );
              return;
            }
            setPages((prev) => {
              const next = new Map<number, ProductListResult>();
              let wasRemoved = false;
              let latestTotal = 0;
              prev.forEach((data, key) => {
                const filtered = data.items.filter(
                  (item) => item.id !== productId,
                );
                if (filtered.length !== data.items.length) {
                  wasRemoved = true;
                }
                latestTotal = data.total;
                next.set(key, { ...data, items: filtered });
              });
              if (wasRemoved) {
                const updatedTotal = Math.max(0, latestTotal - 1);
                next.forEach((data, key) => {
                  next.set(key, {
                    ...data,
                    total: updatedTotal,
                    pageCount: Math.max(
                      1,
                      Math.ceil(
                        updatedTotal / Math.max(1, data.pageSize),
                      ),
                    ),
                  });
                });
              }
              return next;
            });
            setInlineMessage("Produit supprimé.");
          })
          .catch(() => {
            setInlineError(
              "Impossible de supprimer ce produit pour le moment.",
            );
          })
          .finally(() => {
            setPendingDeleteId(null);
          });
      });
    },
    [],
  );

  const totalVisibleText = useMemo(() => {
    const count = mergedItems.length;
    const total = latestMeta.total;
    return `${count} / ${total}`;
  }, [mergedItems.length, latestMeta.total]);

  const loadingMore =
    hasNextPage && loadingPages.has(latestMeta.page + 1);

  return (
    <div className="space-y-4">
      <div className="card grid gap-4 p-4 sm:grid-cols-4 sm:items-end">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="products-search">
            Recherche
          </label>
          <input
            id="products-search"
            type="search"
            className="input"
            placeholder="Nom, SKU, catégorie..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="products-category">
            Catégorie
          </label>
          <select
            id="products-category"
            className="input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "Toutes" : option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="products-status">
            Statut
          </label>
          <select
            id="products-status"
            className="input"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | "actifs" | "inactifs")
            }
          >
            <option value="all">Tous</option>
            <option value="actifs">Actifs</option>
            <option value="inactifs">Inactifs</option>
          </select>
        </div>
        <div className="sm:col-span-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setSearchInput("");
              setCategory("all");
              setStatus("all");
            }}
          >
            Réinitialiser
          </Button>
          <span
            aria-live="polite"
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            {isRefreshing ? "Mise à jour…" : `Résultats : ${totalVisibleText}`}
          </span>
        </div>
      </div>

      {(inlineMessage || inlineError) && (
        <div
          role="status"
          className={clsx(
            "rounded-lg border px-4 py-2 text-sm",
            inlineError
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200",
          )}
        >
          {inlineError ?? inlineMessage}
        </div>
      )}

      <div className="card overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="max-h-[70vh] overflow-auto"
          aria-live="polite"
        >
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
              {virtualizationEnabled && topSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={8}
                    style={{ height: topSpacerHeight }}
                  />
                </tr>
              )}
              {visibleItems.map((product) => (
                <tr
                  key={product.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {product.name}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      SKU : {product.sku}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {product.category ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-600 dark:text-zinc-300">
                    {formatCurrency(
                      fromCents(product.priceHTCents, currencyCode),
                      currencyCode,
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-800 dark:text-zinc-100">
                    {formatCurrency(
                      fromCents(product.priceTTCCents, currencyCode),
                      currencyCode,
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {product.vatRate}%
                  </td>
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
                      <Button
                        asChild
                        variant="secondary"
                        className="px-2 py-1 text-xs"
                        onMouseEnter={() => handlePrefetch(product.id)}
                      >
                        <Link href={`/produits/${product.id}/modifier`}>
                          Modifier
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        onClick={() => handleDelete(product.id)}
                        loading={
                          pendingDeleteId === product.id && isPendingDelete
                        }
                      >
                        Supprimer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {virtualizationEnabled && bottomSpacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td
                    colSpan={8}
                    style={{ height: bottomSpacerHeight }}
                  />
                </tr>
              )}
              {!isRefreshing && mergedItems.length === 0 && (
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
      </div>

      {hasNextPage && (
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleLoadMore}
            loading={loadingMore}
          >
            Charger plus
          </Button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Défilez jusqu&apos;en bas ou utilisez le bouton pour charger d&apos;autres produits.
          </p>
        </div>
      )}
    </div>
  );
}
