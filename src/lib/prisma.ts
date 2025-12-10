import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const isTestEnv = process.env.NODE_ENV === "test";
const baseDatabaseUrl = process.env.DATABASE_URL?.trim();
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const databaseUrl = (isTestEnv ? testDatabaseUrl : baseDatabaseUrl)?.trim();
const DEFAULT_CONNECTION_LIMIT = "5";
const DEFAULT_POOL_TIMEOUT_SECONDS = "10";

if (!databaseUrl) {
  const missingKey = isTestEnv ? "TEST_DATABASE_URL" : "DATABASE_URL";
  throw new Error(
    `${missingKey} must be defined. Update your environment configuration to point to a valid PostgreSQL database.`,
  );
}

// Ensure downstream consumers (including Prisma CLI) see the resolved URL.
process.env.DATABASE_URL = databaseUrl;

const accelerateUrl =
  !isTestEnv && process.env.PRISMA_ACCELERATE_URL?.trim()
    ? process.env.PRISMA_ACCELERATE_URL.trim()
    : null;

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log:
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  datasources: {
    db: {
      // Supabase poolers and serverless envs choke on large pools; default to a
      // single connection with a slightly longer wait unless explicitly overridden.
      url: (() => {
        if (accelerateUrl) return accelerateUrl;
        try {
          const parsed = new URL(databaseUrl);
          if (
            !parsed.searchParams.has("connection_limit") &&
            process.env.PRISMA_CLIENT_CONNECTION_LIMIT !== "0"
          ) {
            parsed.searchParams.set(
              "connection_limit",
              process.env.PRISMA_CLIENT_CONNECTION_LIMIT ??
                DEFAULT_CONNECTION_LIMIT,
            );
          }
          if (
            !parsed.searchParams.has("pool_timeout") &&
            process.env.PRISMA_CLIENT_POOL_TIMEOUT !== "0"
          ) {
            parsed.searchParams.set(
              "pool_timeout",
              process.env.PRISMA_CLIENT_POOL_TIMEOUT ??
                DEFAULT_POOL_TIMEOUT_SECONDS,
            );
          }
          return parsed.toString();
        } catch {
          // If the URL is malformed, fall back to the raw value.
          return databaseUrl;
        }
      })(),
    },
  },
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
