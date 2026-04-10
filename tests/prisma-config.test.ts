import {
  resolvePrismaRuntimeConfig,
  resolvePrismaScriptDatabaseUrl,
  tunePrismaConnectionUrl,
} from "@/lib/prisma-config";

const SUPABASE_TRANSACTION_URL =
  "postgresql://user:pass@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";
const SUPABASE_SESSION_URL =
  "postgresql://user:pass@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require";

describe("prisma-config", () => {
  it("prefers the Supabase session pooler at runtime when the database URL points at the transaction pooler", () => {
    const config = resolvePrismaRuntimeConfig({
      DATABASE_URL: SUPABASE_TRANSACTION_URL,
      DIRECT_URL: SUPABASE_SESSION_URL,
    });

    expect(config.runtimeSource).toBe("direct");
    expect(config.runtimeMode).toBe("auto");
    expect(config.runtimeDatabaseUrl).toContain(":5432/");
    expect(config.runtimeDatabaseUrl).toContain("connection_limit=1");
    expect(config.runtimeDatabaseUrl).toContain("pool_timeout=30");
    expect(config.runtimeDatabaseUrl).toContain(
      "application_name=invoices-app",
    );
  });

  it("uses Prisma Accelerate when configured", () => {
    const config = resolvePrismaRuntimeConfig({
      DATABASE_URL: SUPABASE_TRANSACTION_URL,
      DIRECT_URL: SUPABASE_SESSION_URL,
      PRISMA_ACCELERATE_URL:
        "prisma://accelerate.prisma-data.net/?api_key=test",
    });

    expect(config.runtimeSource).toBe("accelerate");
    expect(config.runtimeDatabaseUrl).toBe(
      "prisma://accelerate.prisma-data.net/?api_key=test",
    );
  });

  it("prefers the direct URL for scripts", () => {
    const url = resolvePrismaScriptDatabaseUrl(
      {
        DATABASE_URL: SUPABASE_TRANSACTION_URL,
        DIRECT_URL: SUPABASE_SESSION_URL,
      },
      { applicationName: "invoices-app:seed" },
    );

    expect(url).toContain(":5432/");
    expect(url).toContain("application_name=invoices-app%3Aseed");
  });

  it("keeps existing tuning parameters intact", () => {
    const url = tunePrismaConnectionUrl(
      "postgresql://user:pass@localhost:5432/app?connection_limit=4&pool_timeout=12&application_name=custom",
      {},
    );

    expect(url).toContain("connection_limit=4");
    expect(url).toContain("pool_timeout=12");
    expect(url).toContain("application_name=custom");
  });

  it("honors test database URLs without switching to direct mode", () => {
    const config = resolvePrismaRuntimeConfig({
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
