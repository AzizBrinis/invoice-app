const APP_URL_ENV_KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL"] as const;
const DEFAULT_APP_HOSTS = ["localhost:3000", "127.0.0.1:3000"];

function normalizeBaseUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  if (!withoutTrailingSlash) {
    return null;
  }
  if (!/^https?:\/\//i.test(withoutTrailingSlash)) {
    throw new Error(
      "APP_URL doit inclure le protocole (http:// ou https://) pour le suivi des e-mails.",
    );
  }
  return withoutTrailingSlash;
}

export function getAppBaseUrl(): string {
  for (const key of APP_URL_ENV_KEYS) {
    const candidate = normalizeBaseUrl(process.env[key]);
    if (candidate) {
      return candidate;
    }
  }

  throw new Error(
    "APP_URL (ou NEXT_PUBLIC_APP_URL) doit être défini pour activer le suivi des e-mails.",
  );
}

export function getAppHostnames(): string[] {
  const raw = process.env.APP_HOSTNAMES;
  if (!raw) {
    return DEFAULT_APP_HOSTS;
  }
  const hosts = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!hosts.length) {
    return DEFAULT_APP_HOSTS;
  }
  return hosts;
}

export function getCatalogEdgeDomain(): string {
  const envValue = process.env.CATALOG_EDGE_DOMAIN?.trim();
  if (envValue) {
    return envValue.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  }
  const fallbackHost = getAppHostnames()[0] ?? "localhost:3000";
  return fallbackHost;
}
