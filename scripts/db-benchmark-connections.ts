import { performance } from "node:perf_hooks";
import {
  createDatabaseSqlClient,
  executeStatement,
  type DatabaseSqlClient,
} from "../src/lib/db/postgres";
import { resolveDatabaseRuntimeConfig } from "../src/lib/db/runtime-config";

type BenchmarkContext = {
  userId: string | null;
};

type BenchmarkScenario = {
  name: string;
  sql: string;
  values: (context: BenchmarkContext) => unknown[];
};

type ScenarioResult = {
  avgMs?: number;
  failed?: string;
  maxMs?: number;
  minMs?: number;
  name: string;
  p95Ms?: number;
  queries: number;
};

const DEFAULT_CONNECTION_COUNTS = [1, 2, 4];

const scenarios: BenchmarkScenario[] = [
  {
    name: "dashboard:recent-invoices",
    sql: `
      SELECT "id", "number", "status", "totalTTCCents", "createdAt"
      FROM "public"."Invoice"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 10
    `,
    values: ({ userId }) => [userId],
  },
  {
    name: "site-orders:list",
    sql: `
      SELECT "id", "orderNumber", "status", "paymentStatus", "totalTTCCents", "createdAt"
      FROM "public"."Order"
      WHERE "userId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 10
    `,
    values: ({ userId }) => [userId],
  },
  {
    name: "messaging:summaries",
    sql: `
      SELECT "id", "mailbox", "uidValidity", "uid", "messageId", "subject",
        "fromLabel", "fromAddress", "toRecipients", "internalDate", "seen",
        "hasAttachments", "previewText", "bodyState", "updatedAt"
      FROM "public"."MessagingLocalMessage"
      WHERE "userId" = $1
      ORDER BY "internalDate" DESC, "uid" DESC
      LIMIT 20
    `,
    values: ({ userId }) => [userId],
  },
  {
    name: "cron:mailbox-sync-state",
    sql: `
      SELECT "id", "mailbox", "status", "lastSuccessfulSyncAt", "updatedAt"
      FROM "public"."MessagingMailboxLocalSyncState"
      WHERE "userId" = $1
      ORDER BY "updatedAt" DESC
      LIMIT 10
    `,
    values: ({ userId }) => [userId],
  },
  {
    name: "cron:background-jobs",
    sql: `
      SELECT "id", "type", "priority", "runAt", "status"
      FROM "public"."BackgroundJob"
      WHERE "status" IN ('PENDING', 'RUNNING')
      ORDER BY "priority" DESC, "runAt" ASC
      LIMIT 20
    `,
    values: () => [],
  },
];

function parseConnectionCounts(value: string | undefined) {
  if (!value) {
    return DEFAULT_CONNECTION_COUNTS;
  }

  const parsed = value
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry > 0);
  return parsed.length > 0 ? Array.from(new Set(parsed)) : DEFAULT_CONNECTION_COUNTS;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values: number[], percent: number) {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.ceil((percent / 100) * sorted.length) - 1,
  );
  return sorted[index];
}

function roundMs(value: number | undefined) {
  return value === undefined ? undefined : Math.round(value * 10) / 10;
}

async function loadBenchmarkContext(sqlClient: DatabaseSqlClient) {
  const [user] = await executeStatement<{ id: string }>(
    'SELECT "id" FROM "public"."User" ORDER BY "createdAt" DESC LIMIT 1',
    [],
    sqlClient,
  );
  return {
    userId: user?.id ?? null,
  } satisfies BenchmarkContext;
}

async function runTimedQuery(
  sqlClient: DatabaseSqlClient,
  scenario: BenchmarkScenario,
  context: BenchmarkContext,
) {
  const startedAt = performance.now();
  await executeStatement(scenario.sql, scenario.values(context), sqlClient);
  return performance.now() - startedAt;
}

async function runScenario(
  sqlClient: DatabaseSqlClient,
  scenario: BenchmarkScenario,
  context: BenchmarkContext,
  options: { concurrency: number; iterations: number },
): Promise<ScenarioResult> {
  try {
    await runTimedQuery(sqlClient, scenario, context);

    const timings: number[] = [];
    for (let iteration = 0; iteration < options.iterations; iteration += 1) {
      const batch = await Promise.all(
        Array.from({ length: options.concurrency }, () =>
          runTimedQuery(sqlClient, scenario, context),
        ),
      );
      timings.push(...batch);
    }

    const totalMs = timings.reduce((sum, value) => sum + value, 0);
    return {
      avgMs: roundMs(totalMs / timings.length),
      maxMs: roundMs(Math.max(...timings)),
      minMs: roundMs(Math.min(...timings)),
      name: scenario.name,
      p95Ms: roundMs(percentile(timings, 95)),
      queries: timings.length,
    };
  } catch (error) {
    return {
      failed: error instanceof Error ? error.message : "Unknown benchmark error.",
      name: scenario.name,
      queries: 0,
    };
  }
}

async function runConnectionBenchmark(maxConnections: number) {
  const env = {
    ...process.env,
    DB_APPLICATION_NAME: `${process.env.DB_APPLICATION_NAME ?? "invoices-app"}:benchmark-${maxConnections}`,
    DB_MAX_CONNECTIONS: String(maxConnections),
    DB_QUERY_LOGGING: process.env.DB_QUERY_LOGGING ?? "off",
  };
  const config = resolveDatabaseRuntimeConfig(env);
  const sqlClient = createDatabaseSqlClient(config.runtimeDatabaseUrl, {
    connectTimeoutSeconds: config.connectTimeoutSeconds,
    idleTimeoutSeconds: config.idleTimeoutSeconds,
    maxConnections: config.maxConnections,
    prepareStatements: config.prepareStatements,
  });

  try {
    const context = await loadBenchmarkContext(sqlClient);
    const iterations = parsePositiveInteger(process.env.DB_BENCHMARK_ITERATIONS, 5);
    const concurrency = parsePositiveInteger(
      process.env.DB_BENCHMARK_CONCURRENCY,
      Math.max(2, maxConnections * 4),
    );

    console.log(
      `\nDB_MAX_CONNECTIONS=${maxConnections} iterations=${iterations} concurrency=${concurrency} user=${context.userId ?? "none"}`,
    );

    const results: ScenarioResult[] = [];
    for (const scenario of scenarios) {
      results.push(
        await runScenario(sqlClient, scenario, context, {
          concurrency,
          iterations,
        }),
      );
    }
    console.table(results);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DB_BENCHMARK_ALLOW_PRODUCTION !== "1"
  ) {
    throw new Error(
      "Refusing to benchmark with NODE_ENV=production. Set DB_BENCHMARK_ALLOW_PRODUCTION=1 if you intentionally want read-only production measurements.",
    );
  }

  const connectionCounts = parseConnectionCounts(process.env.DB_BENCHMARK_CONNECTIONS);
  for (const maxConnections of connectionCounts) {
    await runConnectionBenchmark(maxConnections);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
