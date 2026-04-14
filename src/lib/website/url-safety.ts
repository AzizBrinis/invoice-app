const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;

type PublicHrefSafetyOptions = {
  allowExternalHttp?: boolean;
  allowHash?: boolean;
  allowMailto?: boolean;
  allowRelativePath?: boolean;
  allowTel?: boolean;
};

type SanitizePublicHrefOptions = PublicHrefSafetyOptions & {
  fallback?: string;
};

function normalizeHrefValue(value?: string | null) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || CONTROL_CHAR_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function isSafeRelativePathHref(value?: string | null) {
  const normalized = normalizeHrefValue(value);
  if (!normalized) {
    return false;
  }
  return (
    normalized.startsWith("/") &&
    !normalized.startsWith("//") &&
    !normalized.includes("\\")
  );
}

export function isSafePublicHref(
  value?: string | null,
  options: PublicHrefSafetyOptions = {},
) {
  const normalized = normalizeHrefValue(value);
  if (!normalized) {
    return false;
  }

  const {
    allowExternalHttp = true,
    allowHash = true,
    allowMailto = false,
    allowRelativePath = true,
    allowTel = false,
  } = options;

  if (allowHash && (normalized === "#" || normalized.startsWith("#"))) {
    return true;
  }

  if (allowRelativePath && isSafeRelativePathHref(normalized)) {
    return true;
  }

  if (normalized.startsWith("//")) {
    return false;
  }

  try {
    const url = new URL(normalized);
    if (allowExternalHttp && (url.protocol === "http:" || url.protocol === "https:")) {
      return true;
    }
    if (allowMailto && url.protocol === "mailto:") {
      return true;
    }
    if (allowTel && url.protocol === "tel:") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function sanitizePublicHref(
  value?: string | null,
  options: SanitizePublicHrefOptions = {},
) {
  const normalized = normalizeHrefValue(value);
  const fallback = options.fallback ?? "#";
  if (!normalized) {
    return fallback;
  }
  return isSafePublicHref(normalized, options) ? normalized : fallback;
}

export function sanitizePublicPath(
  value?: string | null,
  fallback = "/",
) {
  const normalized = normalizeHrefValue(value);
  if (!normalized) {
    return fallback;
  }

  const path = normalized.startsWith("/")
    ? `/${normalized.replace(/^\/+/, "")}`
    : `/${normalized}`;

  if (CONTROL_CHAR_PATTERN.test(path) || path.includes("\\")) {
    return fallback;
  }

  return path || fallback;
}

export function isSafeHttpOrRelativeUrl(value?: string | null) {
  return isSafePublicHref(value, {
    allowExternalHttp: true,
    allowRelativePath: true,
  });
}

export function isSafeSocialHref(value?: string | null) {
  return isSafePublicHref(value, {
    allowExternalHttp: true,
    allowMailto: true,
    allowRelativePath: true,
    allowTel: true,
  });
}
