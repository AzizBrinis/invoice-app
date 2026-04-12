import {
  resolveDatabaseRuntimeConfig,
  resolveScriptDatabaseUrl,
} from "@/lib/db/runtime-config";

const SUPABASE_TRANSACTION_URL =
  "postgresql://user:pass@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";
const SUPABASE_SESSION_URL =
  "postgresql://user:pass@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require";

describe("db runtime config", () => {
  it("keeps the transaction pooler at runtime and disables prepared statements when DATABASE_URL already points to Supabase pgbouncer", () => {
    const config = resolveDatabaseRuntimeConfig({
      DATABASE_URL: SUPABASE_TRANSACTION_URL,
      DIRECT_URL: SUPABASE_SESSION_URL,
    });

    expect(config.runtimeSource).toBe("database");
    expect(config.runtimeMode).toBe("auto");
    expect(config.runtimeDatabaseUrl).toContain(":6543/");
    expect(config.runtimeDatabaseUrl).toContain(
      "application_name=invoices-app",
    );
    expect(config.prepareStatements).toBe(false);
    expect(config.maxConnections).toBe(1);
  });

  it("uses the direct session URL when runtime mode is forced to direct", () => {
    const config = resolveDatabaseRuntimeConfig({
      DATABASE_URL: SUPABASE_TRANSACTION_URL,
      DIRECT_URL: SUPABASE_SESSION_URL,
      DB_RUNTIME_URL_MODE: "direct",
    });

    expect(config.runtimeSource).toBe("direct");
    expect(config.runtimeDatabaseUrl).toContain(":5432/");
    expect(config.prepareStatements).toBe(true);
  });

  it("prefers the direct URL for scripts", () => {
    const url = resolveScriptDatabaseUrl(
      {
        DATABASE_URL: SUPABASE_TRANSACTION_URL,
        DIRECT_URL: SUPABASE_SESSION_URL,
      },
      { applicationName: "invoices-app:seed" },
    );

    expect(url).toContain(":5432/");
    expect(url).toContain("application_name=invoices-app%3Aseed");
  });

  it("honors test database URLs without switching to direct mode", () => {
    const config = resolveDatabaseRuntimeConfig({
      NODE_ENV: "test",
      TEST_DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
      DIRECT_URL: SUPABASE_SESSION_URL,
    });

    expect(config.databaseUrl).toBe(
      "postgresql://user:pass@localhost:5432/testdb",
    );
    expect(config.runtimeSource).toBe("database");
    expect(config.runtimeDatabaseUrl).toContain("localhost:5432/testdb");
  });
});
