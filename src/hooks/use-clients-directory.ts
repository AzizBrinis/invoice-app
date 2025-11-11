"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ClientDirectoryItem,
  type ClientDirectoryQuery,
  type ClientDirectoryResponse,
  type ClientDirectoryStatusFilter,
  loadClientPage,
  prefetchClientPage,
  readClientCache,
} from "@/lib/client-directory-cache";

const DEFAULT_PAGE_SIZE = 20;

type UseClientsDirectoryParams = {
  search: string;
  status: ClientDirectoryStatusFilter;
  pageSize?: number;
};

type UseClientsDirectoryResult = {
  items: ClientDirectoryItem[];
  total: number;
  pageCount: number;
  lastLoadedPage: number;
  isInitialLoading: boolean;
  isFetchingMore: boolean;
  isValidating: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  prefetchPage: (page: number) => void;
};

function mergePages(
  pages: ClientDirectoryResponse[],
  next: ClientDirectoryResponse,
) {
  const index = pages.findIndex((page) => page.page === next.page);
  if (index >= 0) {
    const clone = [...pages];
    clone[index] = next;
    return clone;
  }
  return [...pages, next].sort((a, b) => a.page - b.page);
}

export function useClientsDirectory({
  search,
  status,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseClientsDirectoryParams): UseClientsDirectoryResult {
  const normalizedSearch = search.trim();
  const baseQuery = useMemo(
    () => ({
      search: normalizedSearch || undefined,
      status,
      pageSize,
    }),
    [normalizedSearch, status, pageSize],
  );

  const [pages, setPages] = useState<ClientDirectoryResponse[]>([]);
  const [isInitialLoading, setInitialLoading] = useState(true);
  const [isFetchingMore, setFetchingMore] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validatingCountRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const beginValidation = useCallback(() => {
    validatingCountRef.current += 1;
    setIsValidating(true);
  }, []);

  const endValidation = useCallback(() => {
    validatingCountRef.current = Math.max(validatingCountRef.current - 1, 0);
    if (validatingCountRef.current === 0) {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const firstPageQuery: ClientDirectoryQuery = { ...baseQuery, page: 1 };
    const cacheHit = readClientCache(firstPageQuery);
    setError(null);
    if (cacheHit?.data) {
      setPages([cacheHit.data]);
      setInitialLoading(false);
    } else {
      setPages([]);
      setInitialLoading(true);
    }
    const needsFetch = !cacheHit?.isFresh;
    if (!needsFetch) {
      setInitialLoading(false);
      setIsValidating(false);
      return () => {
        cancelled = true;
      };
    }
    beginValidation();
    loadClientPage(firstPageQuery, { force: true })
      .then((data) => {
        if (cancelled || !mountedRef.current) return;
        setPages([data]);
      })
      .catch((err) => {
        if (cancelled || !mountedRef.current) return;
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de récupérer les clients.",
        );
      })
      .finally(() => {
        if (cancelled || !mountedRef.current) return;
        setInitialLoading(false);
        endValidation();
      });

    return () => {
      cancelled = true;
    };
  }, [baseQuery, beginValidation, endValidation]);

  const loadMore = useCallback(async () => {
    if (isFetchingMore) {
      return;
    }
    const lastPage = pages[pages.length - 1];
    const nextPageNumber = lastPage ? lastPage.page + 1 : 1;
    const maxPage = lastPage?.pageCount ?? 1;
    if (lastPage && nextPageNumber > maxPage) {
      return;
    }
    setFetchingMore(true);
    setError(null);
    const nextQuery: ClientDirectoryQuery = {
      ...baseQuery,
      page: nextPageNumber,
    };
    const cacheHit = readClientCache(nextQuery);
    if (cacheHit?.data) {
      setPages((prev) => mergePages(prev, cacheHit.data));
      if (cacheHit.isFresh) {
        setFetchingMore(false);
        return;
      }
    }
    beginValidation();
    try {
      const data = await loadClientPage(nextQuery, { force: true });
      if (!mountedRef.current) {
        return;
      }
      setPages((prev) => mergePages(prev, data));
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (!mountedRef.current) {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de charger la page suivante.",
      );
    } finally {
      if (!mountedRef.current) {
        return;
      }
      setFetchingMore(false);
      endValidation();
    }
  }, [baseQuery, beginValidation, endValidation, isFetchingMore, pages]);

  const refresh = useCallback(async () => {
    const firstPageQuery: ClientDirectoryQuery = { ...baseQuery, page: 1 };
    beginValidation();
    setError(null);
    try {
      const data = await loadClientPage(firstPageQuery, { force: true });
      if (!mountedRef.current) {
        return;
      }
      setPages([data]);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (!mountedRef.current) {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Impossible de rafraîchir la liste.",
      );
    } finally {
      if (!mountedRef.current) {
        return;
      }
      endValidation();
      setInitialLoading(false);
    }
  }, [baseQuery, beginValidation, endValidation]);

  const prefetchPage = useCallback(
    (pageNumber: number) => {
      if (pageNumber < 1) return;
      const query: ClientDirectoryQuery = { ...baseQuery, page: pageNumber };
      const cacheHit = readClientCache(query);
      if (cacheHit?.isFresh) {
        return;
      }
      void prefetchClientPage(query);
    },
    [baseQuery],
  );

  const flattenedItems = useMemo(
    () => pages.flatMap((page) => page.items),
    [pages],
  );
  const total = pages[0]?.total ?? 0;
  const pageCount = pages[0]?.pageCount ?? 0;
  const lastPage = pages[pages.length - 1];
  const hasMore = lastPage ? lastPage.page < pageCount : false;
  const lastLoadedPage = lastPage?.page ?? 0;

  return {
    items: flattenedItems,
    total,
    pageCount,
    lastLoadedPage,
    isInitialLoading,
    isFetchingMore,
    isValidating,
    error,
    hasMore,
    loadMore,
    refresh,
    prefetchPage,
  };
}
