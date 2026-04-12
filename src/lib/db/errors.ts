export type DatabaseErrorMeta = Record<string, unknown> | undefined;

class DatabaseErrorBase extends Error {
  code?: string;
  meta?: DatabaseErrorMeta;

  constructor(message: string, code?: string, meta?: DatabaseErrorMeta) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.meta = meta;
  }
}

export class DatabaseKnownRequestError extends DatabaseErrorBase {
  clientVersion = "supabase-sql";
}

export class DatabaseUnknownRequestError extends DatabaseErrorBase {}

export class DatabaseInitializationError extends DatabaseErrorBase {}

export class DatabaseValidationError extends DatabaseErrorBase {}

export function isDatabaseKnownRequestError(
  error: unknown,
): error is DatabaseKnownRequestError {
  return error instanceof DatabaseKnownRequestError;
}
