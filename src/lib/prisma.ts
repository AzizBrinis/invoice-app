import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const isTestEnv = process.env.NODE_ENV === "test";
const baseDatabaseUrl = process.env.DATABASE_URL?.trim();
const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const databaseUrl = (isTestEnv ? testDatabaseUrl : baseDatabaseUrl)?.trim();

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
      url: accelerateUrl ?? databaseUrl,
    },
  },
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
