import type { PrismaClient } from "@/lib/db/prisma-server";
import { createDatabaseClient } from "@/lib/db/client";

export const db = createDatabaseClient() as unknown as PrismaClient;

// Legacy alias for modules that still use the old local variable name.
export const prisma = db;

export { createDatabaseClient };
