import postgres from "postgres";
import {
  modelSchema,
  type ModelName,
} from "@/lib/db/generated-schema";
import {
  isSupabaseTransactionPoolerUrl,
  resolveDatabaseRuntimeConfig,
} from "@/lib/db/runtime-config";
import { DatabaseInitializationError } from "@/lib/db/errors";

export type SqlLikeFragment = {
  strings: string[];
  values: unknown[];
};

export type DatabaseSqlClient = {
  begin<T>(callback: (sqlClient: DatabaseSqlClient) => Promise<T>): Promise<T>;
  end(options?: { timeout?: number }): Promise<void>;
  unsafe(
    text: string,
    values?: readonly unknown[],
  ): Promise<Record<string, unknown>[]>;
};

const globalForDatabase = globalThis as unknown as {
  dbSql?: DatabaseSqlClient;
  dbSqlConfigKey?: string;
};

type DatabaseSqlClientOptions = {
  connectTimeoutSeconds: number;
  idleTimeoutSeconds: number;
  maxConnections: number;
  prepareStatements: boolean;
};

type QueryExecutionSource = "fragment" | "statement";

type QueryLogMode = "off" | "slow" | "all";

type QueryTarget = {
  model?: ModelName;
  operation?: string;
  table?: string;
};

type QueryLogMetadata = QueryTarget & {
  durationMs: number;
  error?: string;
  parameterCount: number;
  rowCount?: number;
  slow: boolean;
  source: QueryExecutionSource;
  thresholdMs: number;
};

const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 200;

const modelNameByTableName = new Map<string, ModelName>(
  (Object.entries(modelSchema) as Array<[ModelName, { tableName: string }]>).map(
    ([modelName, model]) => [model.tableName, modelName],
  ),
);

const SQL_IDENTIFIER_PATTERN = String.raw`(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)`;

const QUERY_TABLE_PATTERNS = [
  new RegExp(String.raw`\bINSERT\s+INTO\s+(${SQL_IDENTIFIER_PATTERN}(?:\.${SQL_IDENTIFIER_PATTERN})?)`, "i"),
  new RegExp(String.raw`\bUPDATE\s+(${SQL_IDENTIFIER_PATTERN}(?:\.${SQL_IDENTIFIER_PATTERN})?)`, "i"),
  new RegExp(String.raw`\bDELETE\s+FROM\s+(${SQL_IDENTIFIER_PATTERN}(?:\.${SQL_IDENTIFIER_PATTERN})?)`, "i"),
  new RegExp(String.raw`\bFROM\s+(${SQL_IDENTIFIER_PATTERN}(?:\.${SQL_IDENTIFIER_PATTERN})?)`, "i"),
] as const;

function isSqlLikeFragment(value: unknown): value is SqlLikeFragment {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as SqlLikeFragment).strings) && Array.isArray((value as SqlLikeFragment).values);
}

function parsePositiveInteger(
  value: string | undefined | null,
  fallback: number,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseQueryLogMode(value: string | undefined | null): QueryLogMode {
  switch (value?.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
    case "all":
      return "all";
    case "slow":
      return "slow";
    case "0":
    case "false":
    case "no":
    case "off":
      return "off";
    default:
      return "off";
  }
}

function resolveQueryObservabilityConfig(env = process.env) {
  if (env.NODE_ENV === "production") {
    return {
      enabled: false,
      mode: "off" as QueryLogMode,
      slowQueryThresholdMs: DEFAULT_SLOW_QUERY_THRESHOLD_MS,
    };
  }

  const mode = parseQueryLogMode(env.DB_QUERY_LOGGING);
  return {
    enabled: mode !== "off",
    mode,
    slowQueryThresholdMs: parsePositiveInteger(
      env.DB_SLOW_QUERY_THRESHOLD_MS,
      DEFAULT_SLOW_QUERY_THRESHOLD_MS,
    ),
  };
}

function isSqlRaw(value: unknown): value is { kind: "raw"; text: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { kind?: unknown }).kind === "raw" &&
    typeof (value as { text?: unknown }).text === "string"
  );
}

function normalizePrimitiveValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value && typeof value === "object" && "toJSON" in (value as Record<string, unknown>)) {
    const candidate = value as { toJSON?: () => unknown };
    if (typeof candidate.toJSON === "function") {
      return candidate.toJSON();
    }
  }

  return value;
}

function normalizeSqlForInspection(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function parseOperation(text: string) {
  return normalizeSqlForInspection(text).match(/^([a-z]+)/i)?.[1]?.toUpperCase();
}

function unquoteSqlIdentifier(identifier: string) {
  if (identifier.startsWith('"') && identifier.endsWith('"')) {
    return identifier.slice(1, -1).replace(/""/g, '"');
  }
  return identifier;
}

function splitQualifiedIdentifier(identifier: string) {
  const parts: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < identifier.length; index += 1) {
    const char = identifier[index];
    if (char === '"') {
      current += char;
      if (identifier[index + 1] === '"') {
        current += identifier[index + 1];
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "." && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts.map(unquoteSqlIdentifier);
}

function inferQueryTarget(text: string): QueryTarget {
  const normalized = normalizeSqlForInspection(text);
  const matchedIdentifier = QUERY_TABLE_PATTERNS
    .map((pattern) => normalized.match(pattern)?.[1])
    .find(Boolean);
  const table = matchedIdentifier
    ? splitQualifiedIdentifier(matchedIdentifier).at(-1)
    : undefined;
  return {
    model: table ? modelNameByTableName.get(table) : undefined,
    operation: parseOperation(normalized),
    table,
  };
}

function toDurationMs(startedAt: bigint) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function roundDurationMs(durationMs: number) {
  return Math.round(durationMs * 10) / 10;
}

function logQueryTiming(metadata: QueryLogMetadata) {
  const config = resolveQueryObservabilityConfig();
  if (!config.enabled) {
    return;
  }

  if (!metadata.error && config.mode === "slow" && !metadata.slow) {
    return;
  }

  const payload = {
    durationMs: roundDurationMs(metadata.durationMs),
    error: metadata.error,
    model: metadata.model,
    operation: metadata.operation,
    parameterCount: metadata.parameterCount,
    rowCount: metadata.rowCount,
    slow: metadata.slow,
    source: metadata.source,
    table: metadata.table,
    thresholdMs: metadata.thresholdMs,
  };

  if (metadata.error) {
    console.warn("[db] query failed", payload);
  } else if (metadata.slow) {
    console.warn("[db] slow query", payload);
  } else {
    console.debug("[db] query", payload);
  }
}

export function compileSqlFragment(fragment: SqlLikeFragment): {
  text: string;
  values: unknown[];
} {
  const values: unknown[] = [];

  function compileInto(current: SqlLikeFragment): string {
    let text = "";

    for (let index = 0; index < current.strings.length; index += 1) {
      text += current.strings[index] ?? "";

      if (index >= current.values.length) {
        continue;
      }

      const value = current.values[index];
      if (isSqlLikeFragment(value)) {
        text += compileInto(value);
        continue;
      }

      if (isSqlRaw(value)) {
        text += value.text;
        continue;
      }

      values.push(normalizePrimitiveValue(value));
      text += `$${values.length}`;
    }

    return text;
  }

  return { text: compileInto(fragment), values };
}

function buildSqlClient(
  databaseUrl: string,
  options: DatabaseSqlClientOptions,
): DatabaseSqlClient {
  try {
    return postgres(databaseUrl, {
      connect_timeout: options.connectTimeoutSeconds,
      idle_timeout: options.idleTimeoutSeconds,
      max: options.maxConnections,
      prepare: options.prepareStatements,
      transform: {
        undefined: null,
      },
      onnotice() {
        // Supabase surfaces noisy notices for extension-managed schemas.
      },
    }) as unknown as DatabaseSqlClient;
  } catch (error) {
    throw new DatabaseInitializationError(
      error instanceof Error ? error.message : "Failed to initialize database client.",
    );
  }
}

function buildClientConfigKey(
  databaseUrl: string,
  options: DatabaseSqlClientOptions,
) {
  return JSON.stringify({
    connectTimeoutSeconds: options.connectTimeoutSeconds,
    databaseUrl,
    idleTimeoutSeconds: options.idleTimeoutSeconds,
    maxConnections: options.maxConnections,
    prepareStatements: options.prepareStatements,
  });
}

export function createDatabaseSqlClient(
  databaseUrl: string,
  options: Partial<DatabaseSqlClientOptions> = {},
): DatabaseSqlClient {
  return buildSqlClient(databaseUrl, {
    connectTimeoutSeconds: options.connectTimeoutSeconds ?? 10,
    idleTimeoutSeconds: options.idleTimeoutSeconds ?? 20,
    maxConnections: options.maxConnections ?? 1,
    prepareStatements:
      options.prepareStatements ?? !isSupabaseTransactionPoolerUrl(databaseUrl),
  });
}

function getOrCreateDbSql() {
  const config = resolveDatabaseRuntimeConfig(process.env);
  const options = {
    connectTimeoutSeconds: config.connectTimeoutSeconds,
    idleTimeoutSeconds: config.idleTimeoutSeconds,
    maxConnections: config.maxConnections,
    prepareStatements: config.prepareStatements,
  } satisfies DatabaseSqlClientOptions;
  const cacheKey = buildClientConfigKey(config.runtimeDatabaseUrl, options);

  if (
    globalForDatabase.dbSql &&
    globalForDatabase.dbSqlConfigKey === cacheKey
  ) {
    return globalForDatabase.dbSql;
  }

  const previousClient = globalForDatabase.dbSql;
  const client = buildSqlClient(config.runtimeDatabaseUrl, options);

  globalForDatabase.dbSql = client;
  globalForDatabase.dbSqlConfigKey = cacheKey;

  if (
    previousClient &&
    previousClient !== client &&
    typeof previousClient.end === "function"
  ) {
    void previousClient.end({ timeout: 0 }).catch(() => {
      // Best-effort cleanup when the runtime connection settings change.
    });
  }

  return client;
}

export const dbSql = new Proxy({} as DatabaseSqlClient, {
  get(_target, property, receiver) {
    return Reflect.get(getOrCreateDbSql() as object, property, receiver);
  },
}) as DatabaseSqlClient;

export function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

export function quoteQualifiedIdentifier(...parts: string[]) {
  return parts.map(quoteIdentifier).join(".");
}

export async function executeSqlFragment<T = Record<string, unknown>>(
  fragment: SqlLikeFragment,
  sqlClient: DatabaseSqlClient = dbSql,
) {
  const compiled = compileSqlFragment(fragment);
  return executeUnsafeQuery<T>(
    "fragment",
    compiled.text,
    compiled.values,
    sqlClient,
  );
}

export async function executeStatement<T = Record<string, unknown>>(
  text: string,
  values: unknown[] = [],
  sqlClient: DatabaseSqlClient = dbSql,
) {
  return executeUnsafeQuery<T>("statement", text, values, sqlClient);
}

async function executeUnsafeQuery<T = Record<string, unknown>>(
  source: QueryExecutionSource,
  text: string,
  values: readonly unknown[],
  sqlClient: DatabaseSqlClient,
) {
  const config = resolveQueryObservabilityConfig();
  if (!config.enabled) {
    return sqlClient.unsafe(text, values) as Promise<T[]>;
  }

  const startedAt = process.hrtime.bigint();
  const target = inferQueryTarget(text);

  try {
    const rows = await sqlClient.unsafe(text, values);
    const durationMs = toDurationMs(startedAt);
    logQueryTiming({
      ...target,
      durationMs,
      parameterCount: values.length,
      rowCount: Array.isArray(rows) ? rows.length : undefined,
      slow: durationMs >= config.slowQueryThresholdMs,
      source,
      thresholdMs: config.slowQueryThresholdMs,
    });
    return rows as T[];
  } catch (error) {
    const durationMs = toDurationMs(startedAt);
    logQueryTiming({
      ...target,
      durationMs,
      error: error instanceof Error ? error.message : "Unknown database error.",
      parameterCount: values.length,
      slow: durationMs >= config.slowQueryThresholdMs,
      source,
      thresholdMs: config.slowQueryThresholdMs,
    });
    throw error;
  }
}
