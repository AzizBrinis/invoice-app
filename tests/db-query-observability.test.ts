import { afterEach, describe, expect, it, vi } from "vitest";
import {
  executeSqlFragment,
  executeStatement,
  type DatabaseSqlClient,
} from "@/lib/db/postgres";

function createFakeSqlClient(
  handler: (
    statement: string,
    values: readonly unknown[],
  ) => Promise<Record<string, unknown>[]>,
) {
  return {
    begin: vi.fn(),
    end: vi.fn(async () => undefined),
    unsafe: vi.fn(
      async (statement: string, values: readonly unknown[] = []) =>
        handler(statement, values),
    ),
  } satisfies DatabaseSqlClient;
}

describe("db query observability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs non-production query timing with target and row count when enabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DB_QUERY_LOGGING", "all");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sqlClient = createFakeSqlClient(async () => [{ id: "user-1" }]);

    await executeStatement(
      'SELECT "id" FROM "public"."User" WHERE "id" = $1',
      ["user-1"],
      sqlClient,
    );

    expect(warn).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalledOnce();
    expect(debug).toHaveBeenCalledWith(
      "[db] query",
      expect.objectContaining({
        model: "User",
        operation: "SELECT",
        parameterCount: 1,
        rowCount: 1,
        source: "statement",
        table: "User",
      }),
    );
  });

  it("logs slow non-production queries at the configured threshold", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DB_QUERY_LOGGING", "slow");
    vi.stubEnv("DB_SLOW_QUERY_THRESHOLD_MS", "1");
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sqlClient = createFakeSqlClient(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve([{ id: "invoice-1" }]), 5);
        }),
    );

    await executeSqlFragment(
      {
        strings: ['SELECT "id" FROM "public"."Invoice" WHERE "userId" = ', ""],
        values: ["user-1"],
      },
      sqlClient,
    );

    expect(warn).toHaveBeenCalledWith(
      "[db] slow query",
      expect.objectContaining({
        model: "Invoice",
        operation: "SELECT",
        rowCount: 1,
        slow: true,
        source: "fragment",
        table: "Invoice",
        thresholdMs: 1,
      }),
    );
  });

  it("keeps query timing disabled in production even when requested", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DB_QUERY_LOGGING", "all");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sqlClient = createFakeSqlClient(async () => [{ id: "user-1" }]);

    await executeStatement('SELECT "id" FROM "public"."User"', [], sqlClient);

    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps query timing disabled by default outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sqlClient = createFakeSqlClient(async () => [{ id: "user-1" }]);

    await executeStatement('SELECT "id" FROM "public"."User"', [], sqlClient);

    expect(debug).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
