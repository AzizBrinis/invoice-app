-- CreateTable
CREATE TABLE "InvoiceAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL CHECK ("action" IN ('CANCELLATION', 'DELETION')),
    "previousStatus" TEXT CHECK ("previousStatus" IN ('BROUILLON', 'ENVOYEE', 'PAYEE', 'PARTIELLE', 'RETARD', 'ANNULEE')),
    "newStatus" TEXT CHECK ("newStatus" IN ('BROUILLON', 'ENVOYEE', 'PAYEE', 'PARTIELLE', 'RETARD', 'ANNULEE')),
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
