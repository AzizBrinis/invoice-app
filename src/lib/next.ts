const REDIRECT_ERROR_PREFIX = "NEXT_REDIRECT;";

export type RedirectError = Error & { digest: string };

// Next.js throws redirect errors with a digest that begins with NEXT_REDIRECT.
// We can't rely on the internal helper anymore (moved in Next 16), so we detect
// the pattern directly to rethrow those control-flow exceptions.
export function isRedirectError(error: unknown): error is RedirectError {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith(REDIRECT_ERROR_PREFIX);
}

