const UNIQUE_ERROR_CODES = new Set(["P2002", "23505", "unique_violation"]);

type MaybeDbError = {
  code?: unknown;
  meta?: { target?: unknown };
  message?: unknown;
};

function hasUniqueTarget(target: unknown) {
  if (!Array.isArray(target)) {
    return false;
  }
  return target.some(
    (entry) =>
      typeof entry === "string" &&
      entry.toLowerCase().includes("unique"),
  );
}

export function isUniqueConstraintViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const dbError = error as MaybeDbError;
  const code =
    typeof dbError.code === "string" ? dbError.code : undefined;
  if (code && UNIQUE_ERROR_CODES.has(code)) {
    return true;
  }
  if (hasUniqueTarget(dbError.meta?.target)) {
    return true;
  }
  const message =
    typeof dbError.message === "string" ? dbError.message : "";
  if (/duplicate key value|unique constraint/i.test(message)) {
    return true;
  }
  return false;
}
