const DEFAULT_TIMEZONE = "Africa/Tunis";

export function normalizeTimezone(candidate?: string | null): string {
  const trimmed = candidate?.trim();
  if (!trimmed) {
    return DEFAULT_TIMEZONE;
  }
  try {
    // Validate against Intl to ensure the IANA zone exists.
    new Intl.DateTimeFormat("fr-FR", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export { DEFAULT_TIMEZONE };
