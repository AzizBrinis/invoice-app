type ClientDirectoryStatusFilter = "all" | "actifs" | "inactifs";

export type ClientDirectoryQuery = {
  search?: string;
  status: ClientDirectoryStatusFilter;
  page: number;
  pageSize: number;
};

export type ClientDirectoryItem = {
  id: string;
  displayName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  vatNumber: string | null;
  isActive: boolean;
  updatedAt: string;
};

export type ClientDirectoryResponse = {
  items: ClientDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ClientCacheHit = {
  key: string;
  data: ClientDirectoryResponse;
  isFresh: boolean;
  isStale: boolean;
};

type CacheEntry = {
  data?: ClientDirectoryResponse;
  updatedAt?: number;
  promise?: Promise<ClientDirectoryResponse>;
};

export const CLIENT_CACHE_TTL_MS = 45_000;
export const CLIENT_CACHE_SWR_MS = 90_000;

const cache = new Map<string, CacheEntry>();

export function buildClientQueryKey(query: ClientDirectoryQuery) {
  const normalizedSearch = query.search?.trim() ?? "";
  return JSON.stringify({
    search: normalizedSearch,
    status: query.status,
    page: query.page,
    pageSize: query.pageSize,
  });
}

export function readClientCache(
  query: ClientDirectoryQuery,
): ClientCacheHit | null {
  const key = buildClientQueryKey(query);
  const entry = cache.get(key);
  if (!entry?.data || !entry.updatedAt) {
    return null;
  }
  const age = Date.now() - entry.updatedAt;
  return {
    key,
    data: entry.data,
    isFresh: age < CLIENT_CACHE_TTL_MS,
    isStale: age < CLIENT_CACHE_TTL_MS + CLIENT_CACHE_SWR_MS,
  };
}

function storeCacheEntry(
  key: string,
  data: ClientDirectoryResponse,
): ClientDirectoryResponse {
  cache.set(key, { data, updatedAt: Date.now() });
  return data;
}

async function requestClients(query: ClientDirectoryQuery) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status && query.status !== "all") {
    params.set("status", query.status);
  }
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  const response = await fetch(`/api/clients?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : "Impossible de récupérer les clients.";
    throw new Error(message);
  }

  return (await response.json()) as ClientDirectoryResponse;
}

export function loadClientPage(
  query: ClientDirectoryQuery,
  options: { force?: boolean } = {},
) {
  const key = buildClientQueryKey(query);
  const entry = cache.get(key);
  const now = Date.now();
  const isFresh =
    !options.force &&
    entry?.data &&
    entry.updatedAt !== undefined &&
    now - entry.updatedAt < CLIENT_CACHE_TTL_MS;
  if (isFresh && entry?.data) {
    return Promise.resolve(entry.data);
  }

  if (entry?.promise) {
    return entry.promise;
  }

  const pendingPromise = requestClients(query)
    .then((data) => storeCacheEntry(key, data))
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, {
    data: entry?.data,
    updatedAt: entry?.updatedAt,
    promise: pendingPromise,
  });

  pendingPromise.finally(() => {
    const latest = cache.get(key);
    if (!latest) return;
    if (latest.promise === pendingPromise) {
      cache.set(key, {
        data: latest.data,
        updatedAt: latest.updatedAt,
      });
    }
  });

  return pendingPromise;
}

export function prefetchClientPage(query: ClientDirectoryQuery) {
  const hit = readClientCache(query);
  if (hit?.isFresh) {
    return Promise.resolve(hit.data);
  }
  return loadClientPage(query, { force: true }).catch(() => undefined);
}

export function clearClientCache() {
  cache.clear();
}

export type { ClientDirectoryStatusFilter };
