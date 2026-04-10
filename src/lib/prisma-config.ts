const FALLBACK_TEST_DATABASE_URL =
  "postgresql://stub:stub@localhost:5432/testdb";
const DEFAULT_CONNECTION_LIMIT = "1";
const DEFAULT_POOL_TIMEOUT_SECONDS = "30";
const DEFAULT_APPLICATION_NAME = "invoices-app";

export type PrismaRuntimeUrlMode = "auto" | "database" | "direct";
export type PrismaRuntimeSource = "accelerate" | "database" | "direct";

type EnvMap = Record<string, string | undefined>;

export type ResolvedPrismaRuntimeConfig = {
  databaseUrl: string;
  runtimeDatabaseUrl: string;
  runtimeMode: PrismaRuntimeUrlMode;
  runtimeSource: PrismaRuntimeSource;
};

type TuneConnectionUrlOptions = {
  applicationName?: string;
};

function trimEnvValue(value: string | undefined | null) {
  return value?.trim() || null;
}

function parsePrismaRuntimeUrlMode(
  value: string | undefined | null,
): PrismaRuntimeUrlMode {
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

function isSupabaseTransactionPooler(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return isSupabasePoolerHost(parsed.hostname) && parsed.port === "6543";
  } catch {
    return false;
  }
}

function isSupabaseSessionPooler(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    return isSupabasePoolerHost(parsed.hostname) && parsed.port === "5432";
  } catch {
    return false;
  }
}

export function tunePrismaConnectionUrl(
  rawUrl: string,
  env: EnvMap,
  options: TuneConnectionUrlOptions = {},
) {
  if (rawUrl.startsWith("prisma://")) {
    return rawUrl;
  }

  try {
    const parsed = new URL(rawUrl);

    if (
      !parsed.searchParams.has("connection_limit") &&
      env.PRISMA_CLIENT_CONNECTION_LIMIT !== "0"
    ) {
      parsed.searchParams.set(
        "connection_limit",
        env.PRISMA_CLIENT_CONNECTION_LIMIT ?? DEFAULT_CONNECTION_LIMIT,
      );
    }

    if (
      !parsed.searchParams.has("pool_timeout") &&
      env.PRISMA_CLIENT_POOL_TIMEOUT !== "0"
    ) {
      parsed.searchParams.set(
        "pool_timeout",
        env.PRISMA_CLIENT_POOL_TIMEOUT ?? DEFAULT_POOL_TIMEOUT_SECONDS,
      );
    }

    if (!parsed.searchParams.has("application_name")) {
      parsed.searchParams.set(
        "application_name",
        options.applicationName?.trim() ||
          env.PRISMA_APPLICATION_NAME?.trim() ||
          DEFAULT_APPLICATION_NAME,
      );
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

  return (
    isSupabaseTransactionPooler(databaseUrl) &&
    isSupabaseSessionPooler(directUrl)
  );
}

export function resolvePrismaRuntimeConfig(
  env: EnvMap = process.env,
): ResolvedPrismaRuntimeConfig {
  const databaseUrl = getResolvedDatabaseUrl(env);
  const runtimeMode = parsePrismaRuntimeUrlMode(env.PRISMA_RUNTIME_URL_MODE);
  const isTestEnv = env.NODE_ENV === "test";
  const directUrl = trimEnvValue(env.DIRECT_URL);
  const accelerateUrl =
    !isTestEnv && trimEnvValue(env.PRISMA_ACCELERATE_URL);

  if (accelerateUrl) {
    return {
      databaseUrl,
      runtimeDatabaseUrl: accelerateUrl,
      runtimeMode,
      runtimeSource: "accelerate",
    };
  }

  let runtimeSource: PrismaRuntimeSource = "database";
  let runtimeBaseUrl = databaseUrl;

  if (!isTestEnv) {
    if (runtimeMode === "direct") {
      if (!directUrl) {
        throw new Error(
          "DIRECT_URL must be defined when PRISMA_RUNTIME_URL_MODE=direct.",
        );
      }

      runtimeBaseUrl = directUrl;
      runtimeSource = "direct";
    } else if (
      runtimeMode === "auto" &&
      shouldPreferDirectRuntimeUrl(databaseUrl, directUrl)
    ) {
      runtimeBaseUrl = directUrl!;
      runtimeSource = "direct";
    }
  }

  return {
    databaseUrl,
    runtimeDatabaseUrl: tunePrismaConnectionUrl(runtimeBaseUrl, env),
    runtimeMode,
    runtimeSource,
  };
}

export function resolvePrismaScriptDatabaseUrl(
  env: EnvMap = process.env,
  options: TuneConnectionUrlOptions = {},
) {
  const directUrl = trimEnvValue(env.DIRECT_URL);
  const baseUrl = directUrl ?? getResolvedDatabaseUrl(env);
  return tunePrismaConnectionUrl(baseUrl, env, options);
}
