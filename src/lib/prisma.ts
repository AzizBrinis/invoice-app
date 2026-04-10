import { PrismaClient, Prisma } from "@prisma/client";
import { resolvePrismaRuntimeConfig } from "@/lib/prisma-config";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const { runtimeDatabaseUrl } = resolvePrismaRuntimeConfig(process.env);

// Ensure downstream consumers see the runtime URL that Prisma is using.
process.env.DATABASE_URL = runtimeDatabaseUrl;

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log:
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  datasources: {
    db: {
      url: runtimeDatabaseUrl,
    },
  },
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
