import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be defined. Update your .env or Vercel environment to point to the production database.",
  );
}

const accelerateUrl = process.env.PRISMA_ACCELERATE_URL?.trim();

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log:
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
};

if (accelerateUrl) {
  prismaClientOptions.datasources = {
    db: {
      url: accelerateUrl,
    },
  };
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
