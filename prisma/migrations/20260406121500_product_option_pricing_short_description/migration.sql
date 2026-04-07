ALTER TABLE "Product"
ADD COLUMN "shortDescriptionHtml" TEXT,
ADD COLUMN "defaultDiscountAmountCents" INTEGER;

UPDATE "Product"
SET "shortDescriptionHtml" = "excerpt"
WHERE "shortDescriptionHtml" IS NULL
  AND "excerpt" IS NOT NULL
  AND LENGTH(TRIM("excerpt")) > 0;
