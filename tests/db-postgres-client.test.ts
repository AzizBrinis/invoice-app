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
  it("applies pooler backpressure to statements and leaves transaction reservation to the driver", async () => {
    const runtimeModule = await import("@/lib/db/runtime-config");
    vi.mocked(runtimeModule.isSupabaseTransactionPoolerUrl).mockReturnValueOnce(true);
    const { createDatabaseSqlClient } = await import("@/lib/db/postgres");
    const client = createDatabaseSqlClient("postgresql://user:pass@pooler:6543/postgres", { prepareStatements: false });
    const driver = postgresMock.mock.results[0].value;
    const tx = { unsafe: vi.fn().mockResolvedValue([{ n: 2 }]) };
    driver.begin.mockImplementation((run: (tx: unknown) => Promise<unknown>) => run(tx));

    await client.unsafe("select 1");
    expect(await client.begin((sql) => sql.unsafe("select 2"))).toEqual([{ n: 2 }]);
    const options = { onexecute: expect.any(Function) };
    expect(driver.unsafe).toHaveBeenCalledWith("select 1", [], options);
    expect(tx.unsafe).toHaveBeenCalledWith("select 2", [], options);
    expect(tx.unsafe.mock.calls[0][2].onexecute()).toBe(false);
    expect(postgresMock.mock.calls[0]).not.toContainEqual(expect.objectContaining({ max_pipeline: 0 }));
  });

  it("parses NUMERIC amounts for legacy metadata and raw queries during migration", async () => {
    const { dbSql } = await import("@/lib/db/postgres");
    void dbSql.unsafe;
    const options = (postgresMock.mock.calls[0] as unknown as [string, {
      types: { numeric: { from: number[]; parse: (value: string) => number } };
    }])[1];
    expect(options.types.numeric.from).toEqual([1700]);
    for (const [stored, expected] of [["1234.500", 1234.5], ["1234.000", 1234], ["0.001", 0.001], ["2147483647.000", 2147483647]] as const) {
      expect(options.types.numeric.parse(stored)).toBe(expected);
    }
    for (const invalid of ["NaN", "Infinity", "9007199254740992"]) {
      expect(() => options.types.numeric.parse(invalid)).toThrow(RangeError);
    }
  });

});
