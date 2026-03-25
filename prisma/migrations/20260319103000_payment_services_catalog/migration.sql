CREATE TABLE "PaymentService" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceClientId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "privateNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentService_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PaymentService" (
    "id",
    "userId",
    "sourceClientId",
    "title",
    "details",
    "priceCents",
    "notes",
    "privateNotes",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    "clientId",
    "title",
    "details",
    "priceCents",
    "notes",
    "privateNotes",
    "isActive",
    "createdAt",
    "updatedAt"
FROM "ClientService";

CREATE INDEX "PaymentService_userId_updatedAt_idx" ON "PaymentService"("userId", "updatedAt");
CREATE INDEX "PaymentService_userId_sourceClientId_updatedAt_idx" ON "PaymentService"("userId", "sourceClientId", "updatedAt");

ALTER TABLE "PaymentService" ADD CONSTRAINT "PaymentService_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentService" ADD CONSTRAINT "PaymentService_sourceClientId_fkey" FOREIGN KEY ("sourceClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientPaymentService" DROP CONSTRAINT "ClientPaymentService_clientServiceId_fkey";
ALTER TABLE "ClientPaymentService" ADD CONSTRAINT "ClientPaymentService_clientServiceId_fkey" FOREIGN KEY ("clientServiceId") REFERENCES "PaymentService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE "ClientService";
