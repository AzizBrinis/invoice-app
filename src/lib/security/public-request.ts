import { resolveRequestHost } from "@/lib/catalog-host";

type HeadersLike = {
  get(name: string): string | null;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_MAX_ENTRIES = 5000;

const rateLimitGlobal = globalThis as typeof globalThis & {
  __publicRouteRateLimitStore?: Map<string, RateLimitEntry>;
};

function getRateLimitStore() {
  if (!rateLimitGlobal.__publicRouteRateLimitStore) {
    rateLimitGlobal.__publicRouteRateLimitStore = new Map();
  }
  return rateLimitGlobal.__publicRouteRateLimitStore;
}

function pruneRateLimitStore(now: number) {
  const store = getRateLimitStore();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }

  if (store.size <= RATE_LIMIT_MAX_ENTRIES) {
    return;
  }

  const overflow = store.size - RATE_LIMIT_MAX_ENTRIES;
  let removed = 0;
  for (const key of store.keys()) {
    store.delete(key);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

function normalizeKeySegment(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.replace(/[^a-z0-9._:@-]+/g, "_").slice(0, 160);
}

function extractComparableHost(value: string, message: string) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    throw new PublicRequestSecurityError(message, { statusCode: 403 });
  }
}

export class PublicRequestSecurityError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    options?: { statusCode?: number; retryAfterSeconds?: number },
  ) {
    super(message);
    this.name = "PublicRequestSecurityError";
    this.statusCode = options?.statusCode ?? 400;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export function getClientIpFromHeaders(headers: HeadersLike) {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("true-client-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0] ?? null,
  ];

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function buildPublicRateLimitKey(options: {
  scope: string;
  headers: HeadersLike;
  parts?: Array<string | null | undefined>;
}) {
  const ip = getClientIpFromHeaders(options.headers) ?? "unknown";
  const segments = [
    normalizeKeySegment(options.scope),
    normalizeKeySegment(ip),
    ...(options.parts ?? [])
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizeKeySegment(value)),
  ];
  return segments.join(":");
}

export function assertSameOriginMutationRequest(
  headers: HeadersLike,
  message = "Invalid request origin.",
) {
  const fetchSite = headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") {
    throw new PublicRequestSecurityError(message, { statusCode: 403 });
  }

  const originHeader = headers.get("origin")?.trim();
  const refererHeader = headers.get("referer")?.trim();
  if (!originHeader && !refererHeader) {
    return;
  }

  const requestHost = resolveRequestHost(headers)?.trim().toLowerCase();
  if (!requestHost) {
    throw new PublicRequestSecurityError(message, { statusCode: 403 });
  }

  if (originHeader) {
    const originHost = extractComparableHost(originHeader, message);
    if (originHost !== requestHost) {
      throw new PublicRequestSecurityError(message, { statusCode: 403 });
    }
    return;
  }

  if (refererHeader) {
    const refererHost = extractComparableHost(refererHeader, message);
    if (refererHost !== requestHost) {
      throw new PublicRequestSecurityError(message, { statusCode: 403 });
    }
  }
}

export function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  message?: string;
  now?: number;
}) {
  const now = options.now ?? Date.now();
  pruneRateLimitStore(now);

  const store = getRateLimitStore();
  const current = store.get(options.key);
  if (!current || current.resetAt <= now) {
    store.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return;
  }

  if (current.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000),
    );
    throw new PublicRequestSecurityError(
      options.message ?? "Too many requests. Please wait and try again.",
      {
        statusCode: 429,
        retryAfterSeconds,
      },
    );
  }

  current.count += 1;
  store.set(options.key, current);
}

export function resolveSecurityErrorResponseInit(
  error: unknown,
  fallbackStatus = 400,
) {
  if (!(error instanceof PublicRequestSecurityError)) {
    return {
      status: fallbackStatus,
      headers: undefined as HeadersInit | undefined,
    };
  }

  const headers =
    error.retryAfterSeconds != null
      ? ({
          "Retry-After": String(error.retryAfterSeconds),
        } satisfies HeadersInit)
      : undefined;

  return {
    status: error.statusCode,
    headers,
  };
}
