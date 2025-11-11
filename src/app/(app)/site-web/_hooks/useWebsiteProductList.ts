"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  WebsiteProductListFilters,
  WebsiteProductListResult,
  WebsiteProductSummary,
} from "@/server/website";

const CACHE_TTL_MS = 30_000;
const CACHE_STALE_MS = 120_000;
const DEFAULT_PAGE_SIZE = 40;

type NormalizedFilters = {
  search?: string;
  visibility: NonNullable<WebsiteProductListFilters["visibility"]>;
  includeInactive: boolean;
  pageSize: number;
};

type CacheEntry = {
  fetchedAt: number;
  pages: Record<number, WebsiteProductSummary[]>;
  meta: Pick<
    WebsiteProductListResult,
    "total" | "listed" | "filteredTotal" | "pageCount" | "pageSize"
  >;
};

const queryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<WebsiteProductListResult>>();

function normalizeFilters(
  filters: Partial<NormalizedFilters>,
): NormalizedFilters {
  return {
    search: filters.search?.trim() || undefined,
    visibility: filters.visibility ?? "all",
    includeInactive: filters.includeInactive ?? false,
    pageSize: filters.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

function serializeFilters(filters: NormalizedFilters) {
  return JSON.stringify(filters);
}

function buildSearchParams(
  filters: NormalizedFilters,
  page: number,
) {
  const searchParams = new URLSearchParams();
  if (filters.search) {
    searchParams.set("q", filters.search);
  }
  if (filters.visibility !== "all") {
    searchParams.set("visibility", filters.visibility);
  }
  if (filters.includeInactive) {
    searchParams.set("inactive", "true");
  }
  searchParams.set("page", String(page));
  searchParams.set("pageSize", String(filters.pageSize));
  return searchParams;
}

async function fetchPageWithCache(
  baseKey: string,
  filters: NormalizedFilters,
  page: number,
  signal?: AbortSignal,
) {
  const inFlightKey = `${baseKey}:${page}`;
  if (inFlightRequests.has(inFlightKey)) {
    return inFlightRequests.get(inFlightKey)!;
  }

  const searchParams = buildSearchParams(filters, page);
  const requestPromise = fetch(`/api/site-web/products?${searchParams.toString()}`, {
    cache: "no-store",
    signal,
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error("REQUEST_FAILED");
    }
    const data = await response.json() as WebsiteProductListResult;
    const existing = queryCache.get(baseKey);
    const nextPages = {
      ...(existing?.pages ?? {}),
      [data.page]: data.items,
    };
    queryCache.set(baseKey, {
      fetchedAt: Date.now(),
      pages: nextPages,
      meta: {
        total: data.total,
        listed: data.listed,
        filteredTotal: data.filteredTotal,
        pageCount: data.pageCount,
        pageSize: data.pageSize,
      },
    });
    return data;
  });

  inFlightRequests.set(inFlightKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(inFlightKey);
  }
}

function flattenPages(pages: Record<number, WebsiteProductSummary[]>) {
  return Object.keys(pages)
    .map((value) => Number(value))
    .sort((a, b) => a - b)
    .flatMap((pageNumber) => pages[pageNumber] ?? []);
}

export function useWebsiteProductList(
  inputFilters: Partial<NormalizedFilters>,
) {
  const {
    search: inputSearch,
    visibility: inputVisibility,
    includeInactive: inputIncludeInactive,
    pageSize: inputPageSize,
  } = inputFilters;
  const filters = useMemo(
    () =>
      normalizeFilters({
        search: inputSearch,
        visibility: inputVisibility,
        includeInactive: inputIncludeInactive,
        pageSize: inputPageSize,
      }),
    [inputSearch, inputVisibility, inputIncludeInactive, inputPageSize],
  );
  const baseKey = useMemo(() => serializeFilters(filters), [filters]);
  const [pages, setPages] = useState<Record<number, WebsiteProductSummary[]>>({});
  const [meta, setMeta] = useState<CacheEntry["meta"] | null>(null);
  const [loadingPage, setLoadingPage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllers = useRef(new Map<number, AbortController>());

  const restoreFromCache = useCallback(() => {
    const entry = queryCache.get(baseKey);
    if (!entry) {
      setPages({});
      setMeta(null);
      return { hasCache: false, isStale: false };
    }

    const age = Date.now() - entry.fetchedAt;
    if (age > CACHE_STALE_MS) {
      queryCache.delete(baseKey);
      setPages({});
      setMeta(null);
      return { hasCache: false, isStale: false };
    }

    setPages(entry.pages);
    setMeta(entry.meta);
    return {
      hasCache: true,
      isStale: age > CACHE_TTL_MS,
    };
  }, [baseKey]);

  const loadPage = useCallback(
    async (page: number, options?: { force?: boolean }) => {
      const cachedEntry = queryCache.get(baseKey);
      const hasCachedPage = cachedEntry?.pages?.[page];
      if (hasCachedPage && !options?.force) {
        setPages(cachedEntry.pages);
        setMeta(cachedEntry.meta);
        return;
      }

      setLoadingPage(page);
      setError(null);
      const controller = new AbortController();
      abortControllers.current.set(page, controller);
      try {
        await fetchPageWithCache(baseKey, filters, page, controller.signal);
        const entry = queryCache.get(baseKey);
        if (entry) {
          setPages(entry.pages);
          setMeta(entry.meta);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("[useWebsiteProductList] loadPage failed", error);
        setError(
          "Impossible de charger les produits listés pour le moment.",
        );
      } finally {
        abortControllers.current.delete(page);
        setLoadingPage((current) => (current === page ? null : current));
      }
    },
    [baseKey, filters],
  );

  useEffect(() => {
    const { hasCache, isStale } = restoreFromCache();
    if (!hasCache) {
      void loadPage(1);
    } else if (isStale) {
      void loadPage(1, { force: true });
    }
  }, [loadPage, restoreFromCache]);

  useEffect(() => {
    const controllers = abortControllers.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, [baseKey]);

  const orderedPages = useMemo(
    () =>
      Object.keys(pages)
        .map((value) => Number(value))
        .sort((a, b) => a - b),
    [pages],
  );

  const items = useMemo(() => flattenPages(pages), [pages]);

  const nextPage = useMemo(() => {
    if (!meta || meta.pageCount === 0) {
      return null;
    }
    if (!orderedPages.length) {
      return 1;
    }
    const lastPage = orderedPages[orderedPages.length - 1];
    return lastPage < meta.pageCount ? lastPage + 1 : null;
  }, [meta, orderedPages]);

  const hasMore = nextPage != null;

  const loadMore = useCallback(() => {
    if (nextPage) {
      void loadPage(nextPage);
    }
  }, [loadPage, nextPage]);

  const refresh = useCallback(() => {
    queryCache.delete(baseKey);
    void loadPage(1, { force: true });
  }, [baseKey, loadPage]);

  return {
    items,
    meta,
    loadingPage,
    error,
    hasMore,
    loadMore,
    refresh,
    isEmpty: meta?.filteredTotal === 0,
    isInitialLoading: !orderedPages.length && loadingPage !== null,
  };
}
