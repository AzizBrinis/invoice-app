-- Optimize invoice filtering and pagination
DROP INDEX IF EXISTS "Invoice_userId_status_idx";
DROP INDEX IF EXISTS "Invoice_userId_clientId_idx";

CREATE INDEX "Invoice_userId_issueDate_idx"
  ON "Invoice"("userId", "issueDate" DESC, "id" DESC);
CREATE INDEX "Invoice_userId_status_issueDate_idx"
  ON "Invoice"("userId", "status", "issueDate" DESC, "id" DESC);
CREATE INDEX "Invoice_userId_clientId_issueDate_idx"
  ON "Invoice"("userId", "clientId", "issueDate" DESC, "id" DESC);
CREATE INDEX "Invoice_userId_dueDate_idx"
  ON "Invoice"("userId", "dueDate", "id" DESC);
