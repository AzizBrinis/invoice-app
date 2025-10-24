import path from "path";
import { PrismaClient } from "@prisma/client";

const SQLITE_RELATIVE_PATH = "prisma/prisma/dev.db";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __prismaDatabaseUrlWarned?: boolean;
};

if (!process.env.DATABASE_URL) {
  const absolutePath = path.resolve(process.cwd(), SQLITE_RELATIVE_PATH);
  const fallbackUrl = `file:${absolutePath}`;
  process.env.DATABASE_URL = fallbackUrl;

  if (
    process.env.NODE_ENV !== "production" &&
    !globalForPrisma.__prismaDatabaseUrlWarned
  ) {
    console.warn(
      `DATABASE_URL is not set. Falling back to bundled SQLite database at ${fallbackUrl}.`,
    );
    globalForPrisma.__prismaDatabaseUrlWarned = true;
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
