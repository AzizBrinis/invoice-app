const APP_URL_ENV_KEYS = ["APP_URL", "NEXT_PUBLIC_APP_URL"] as const;

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
