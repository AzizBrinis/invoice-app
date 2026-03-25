-- CreateEnum
CREATE TYPE "OrderPaymentProofStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "OrderPayment"
ADD COLUMN "proofUrl" TEXT,
ADD COLUMN "proofMimeType" TEXT,
ADD COLUMN "proofSizeBytes" INTEGER,
ADD COLUMN "proofUploadedAt" TIMESTAMP(3),
ADD COLUMN "proofStatus" "OrderPaymentProofStatus";
