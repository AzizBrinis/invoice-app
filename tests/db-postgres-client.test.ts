import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postgresMock = vi.fn(() => ({
  begin: vi.fn(),
  end: vi.fn(async () => undefined),
  unsafe: vi.fn(async () => []),
}));

const runtimeConfigMock = vi.fn(() => ({
  applicationName: "invoices-app",
  connectTimeoutSeconds: 10,
  databaseUrl: "postgresql://user:pass@localhost:5432/testdb",
  idleTimeoutSeconds: 20,
  maxConnections: 1,
  prepareStatements: true,
  runtimeDatabaseUrl: "postgresql://user:pass@localhost:5432/testdb?application_name=invoices-app",
  runtimeMode: "auto" as const,
  runtimeSource: "database" as const,
  usesSupabaseTransactionPooler: false,
}));

vi.mock("postgres", () => ({
  default: postgresMock,
}));

vi.mock("@/lib/db/runtime-config", () => ({
  isSupabaseTransactionPoolerUrl: vi.fn(() => false),
  resolveDatabaseRuntimeConfig: runtimeConfigMock,
}));

describe("db postgres client caching", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const mutableEnv = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    vi.resetModules();
    postgresMock.mockClear();
    runtimeConfigMock.mockClear();
    delete (globalThis as { dbSql?: unknown }).dbSql;
    delete (globalThis as { dbSqlConfigKey?: unknown }).dbSqlConfigKey;
    mutableEnv.NODE_ENV = "production";
  });

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    delete (globalThis as { dbSql?: unknown }).dbSql;
    delete (globalThis as { dbSqlConfigKey?: unknown }).dbSqlConfigKey;
  });

  it("reuses one postgres client across production accesses", async () => {
    const { dbSql } = await import("@/lib/db/postgres");

    void dbSql.unsafe;
    void dbSql.unsafe;
    void dbSql.begin;

    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(runtimeConfigMock).toHaveBeenCalledTimes(3);
  });
});
