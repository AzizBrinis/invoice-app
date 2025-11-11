-- Improve quote list performance by supporting ordered lookups and search filters.
CREATE INDEX "Quote_userId_issueDate_id_idx" ON "Quote"("userId", "issueDate", "id");
CREATE INDEX "Quote_userId_number_idx" ON "Quote"("userId", "number");
CREATE INDEX "Quote_userId_reference_idx" ON "Quote"("userId", "reference");
