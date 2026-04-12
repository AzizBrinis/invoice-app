const FALLBACK_TEST_DATABASE_URL =
  "postgresql://stub:stub@localhost:5432/testdb";
const DEFAULT_MAX_CONNECTIONS = 1;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 20;
const DEFAULT_CONNECT_TIMEOUT_SECONDS = 10;
const DEFAULT_APPLICATION_NAME = "invoices-app";

type EnvMap = Record<string, string | undefined>;

export type DatabaseRuntimeUrlMode = "auto" | "database" | "direct";
export type DatabaseRuntimeSource = "database" | "direct";

export type ResolvedDatabaseRuntimeConfig = {
  applicationName: string;
  connectTimeoutSeconds: number;
  databaseUrl: string;
  idleTimeoutSeconds: number;
  maxConnections: number;
  prepareStatements: boolean;
  runtimeDatabaseUrl: string;
  runtimeMode: DatabaseRuntimeUrlMode;
  runtimeSource: DatabaseRuntimeSource;
  usesSupabaseTransactionPooler: boolean;
};

function trimEnvValue(value: string | undefined | null) {
  return value?.trim() || null;
}

function parseInteger(
  value: string | undefined | null,
  fallback: number,
  minimum = 1,
) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(parsed, minimum);
}

function parseBoolean(value: string | undefined | null, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return fallback;
  }
}

function parseDatabaseRuntimeUrlMode(
  value: string | undefined | null,
): DatabaseRuntimeUrlMode {
  switch (value?.trim().toLowerCase()) {
    case "database":
      return "database";
    case "direct":
      return "direct";
    default:
      return "auto";
  }
}

function isSupabasePoolerHost(hostname: string) {
  return hostname.toLowerCase().endsWith(".pooler.supabase.com");
}

export function isSupabaseTransactionPoolerUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return isSupabasePoolerHost(parsed.hostname) && parsed.port === "6543";
  } catch {
    return false;
  }
}

export function isSupabaseSessionPoolerUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return isSupabasePoolerHost(parsed.hostname) && parsed.port === "5432";
  } catch {
    return false;
  }
}

function withApplicationName(rawUrl: string, applicationName: string) {
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.searchParams.has("application_name")) {
      parsed.searchParams.set("application_name", applicationName);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function getResolvedDatabaseUrl(env: EnvMap) {
  const isTestEnv = env.NODE_ENV === "test";
  const databaseUrl = trimEnvValue(
    isTestEnv
      ? env.TEST_DATABASE_URL ?? FALLBACK_TEST_DATABASE_URL
      : env.DATABASE_URL,
  );

  if (!databaseUrl) {
    const missingKey = isTestEnv ? "TEST_DATABASE_URL" : "DATABASE_URL";
    throw new Error(
      `${missingKey} must be defined. Update your environment configuration to point to a valid PostgreSQL database.`,
    );
  }

  return databaseUrl;
}

function shouldPreferDirectRuntimeUrl(databaseUrl: string, directUrl: string | null) {
  if (!directUrl) {
    return false;
  }

  if (isSupabaseTransactionPoolerUrl(databaseUrl)) {
    return false;
  }

  return !isSupabaseSessionPoolerUrl(databaseUrl) && isSupabaseSessionPoolerUrl(directUrl);
}

export function resolveDatabaseRuntimeConfig(
  env: EnvMap = process.env,
): ResolvedDatabaseRuntimeConfig {
  const databaseUrl = getResolvedDatabaseUrl(env);
  const isTestEnv = env.NODE_ENV === "test";
  const runtimeMode = parseDatabaseRuntimeUrlMode(env.DB_RUNTIME_URL_MODE);
  const directUrl = trimEnvValue(env.DIRECT_URL);
  const applicationName =
    trimEnvValue(env.DB_APPLICATION_NAME) ?? DEFAULT_APPLICATION_NAME;

  let runtimeSource: DatabaseRuntimeSource = "database";
  let runtimeBaseUrl = databaseUrl;

  if (runtimeMode === "direct") {
    if (!directUrl) {
      throw new Error("DIRECT_URL must be defined when DB_RUNTIME_URL_MODE=direct.");
    }

    runtimeSource = "direct";
    runtimeBaseUrl = directUrl;
  } else if (
    !isTestEnv &&
    runtimeMode === "auto" &&
    shouldPreferDirectRuntimeUrl(databaseUrl, directUrl)
  ) {
    runtimeSource = "direct";
    runtimeBaseUrl = directUrl!;
  }

  const runtimeDatabaseUrl = withApplicationName(runtimeBaseUrl, applicationName);
  const usesSupabaseTransactionPooler =
    runtimeSource === "database" && isSupabaseTransactionPoolerUrl(runtimeDatabaseUrl);

  return {
    applicationName,
    connectTimeoutSeconds: parseInteger(
      env.DB_CONNECT_TIMEOUT_SECONDS,
      DEFAULT_CONNECT_TIMEOUT_SECONDS,
    ),
    databaseUrl,
    idleTimeoutSeconds: parseInteger(
      env.DB_IDLE_TIMEOUT_SECONDS,
      DEFAULT_IDLE_TIMEOUT_SECONDS,
    ),
    maxConnections: parseInteger(env.DB_MAX_CONNECTIONS, DEFAULT_MAX_CONNECTIONS),
    prepareStatements: parseBoolean(
      env.DB_PREPARE_STATEMENTS,
      !usesSupabaseTransactionPooler,
    ),
    runtimeDatabaseUrl,
    runtimeMode,
    runtimeSource,
    usesSupabaseTransactionPooler,
  };
}

export function resolveScriptDatabaseUrl(
  env: EnvMap = process.env,
  options: { applicationName?: string } = {},
) {
  const directUrl = trimEnvValue(env.DIRECT_URL);
  const baseUrl = directUrl ?? getResolvedDatabaseUrl(env);
  const applicationName =
    trimEnvValue(options.applicationName) ??
    trimEnvValue(env.DB_APPLICATION_NAME) ??
    DEFAULT_APPLICATION_NAME;

  return withApplicationName(baseUrl, applicationName);
}
