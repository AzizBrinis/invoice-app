-- Enable trigram search helpers if not already present
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Client search indexes
CREATE INDEX "Client_displayName_trgm_idx" ON "Client" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX "Client_companyName_trgm_idx" ON "Client" USING GIN ("companyName" gin_trgm_ops);
CREATE INDEX "Client_email_trgm_idx" ON "Client" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "Client_phone_trgm_idx" ON "Client" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX "Client_vatNumber_trgm_idx" ON "Client" USING GIN ("vatNumber" gin_trgm_ops);

-- Product search indexes
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "Product_description_trgm_idx" ON "Product" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "Product_category_trgm_idx" ON "Product" USING GIN ("category" gin_trgm_ops);
