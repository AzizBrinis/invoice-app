-- Add configurable payment methods for client payment accounts
ALTER TABLE "CompanySettings"
ADD COLUMN "clientPaymentMethods" JSONB;

UPDATE "CompanySettings"
SET "clientPaymentMethods" = '["Espèces / Cash","Chèque","Virement bancaire","Carte bancaire"]'::jsonb
WHERE "clientPaymentMethods" IS NULL;
