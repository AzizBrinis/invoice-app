-- CreateTable
CREATE TABLE "MessagingSavedResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PLAINTEXT',
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MessagingSavedResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceAuditLog" ("action", "createdAt", "id", "invoiceId", "newStatus", "note", "previousStatus", "userId") SELECT "action", "createdAt", "id", "invoiceId", "newStatus", "note", "previousStatus", "userId" FROM "InvoiceAuditLog";
DROP TABLE "InvoiceAuditLog";
ALTER TABLE "new_InvoiceAuditLog" RENAME TO "InvoiceAuditLog";
CREATE INDEX "InvoiceAuditLog_userId_invoiceId_idx" ON "InvoiceAuditLog"("userId", "invoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "MessagingSavedResponse_userId_title_idx" ON "MessagingSavedResponse"("userId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "MessagingSavedResponse_userId_slug_key" ON "MessagingSavedResponse"("userId", "slug");
