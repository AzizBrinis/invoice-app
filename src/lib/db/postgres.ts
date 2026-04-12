import postgres from "postgres";
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

function isSqlLikeFragment(value: unknown): value is SqlLikeFragment {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as SqlLikeFragment).strings) && Array.isArray((value as SqlLikeFragment).values);
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
  return sqlClient.unsafe(compiled.text, compiled.values) as Promise<T[]>;
}

export async function executeStatement(
  text: string,
  values: unknown[] = [],
  sqlClient: DatabaseSqlClient = dbSql,
) {
  return sqlClient.unsafe(text, values) as Promise<Record<string, unknown>[]>;
}
