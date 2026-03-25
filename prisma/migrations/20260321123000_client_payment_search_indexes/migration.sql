CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Client payment search indexes
CREATE INDEX IF NOT EXISTS "ClientPayment_receiptNumber_trgm_idx"
  ON "ClientPayment" USING GIN ("receiptNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ClientPayment_reference_trgm_idx"
  ON "ClientPayment" USING GIN ("reference" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ClientPayment_method_trgm_idx"
  ON "ClientPayment" USING GIN ("method" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ClientPayment_description_trgm_idx"
  ON "ClientPayment" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ClientPayment_note_trgm_idx"
  ON "ClientPayment" USING GIN ("note" gin_trgm_ops);

-- Linked payment service snapshot search indexes
CREATE INDEX IF NOT EXISTS "ClientPaymentService_titleSnapshot_trgm_idx"
  ON "ClientPaymentService" USING GIN ("titleSnapshot" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "ClientPaymentService_detailsSnapshot_trgm_idx"
  ON "ClientPaymentService" USING GIN ("detailsSnapshot" gin_trgm_ops);

-- Service catalog search indexes
CREATE INDEX IF NOT EXISTS "PaymentService_title_trgm_idx"
  ON "PaymentService" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PaymentService_details_trgm_idx"
  ON "PaymentService" USING GIN ("details" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PaymentService_notes_trgm_idx"
  ON "PaymentService" USING GIN ("notes" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "PaymentService_privateNotes_trgm_idx"
  ON "PaymentService" USING GIN ("privateNotes" gin_trgm_ops);
