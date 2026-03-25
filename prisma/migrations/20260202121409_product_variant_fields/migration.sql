-- Add product content + options fields
ALTER TABLE "Product" ADD COLUMN "descriptionHtml" TEXT;
ALTER TABLE "Product" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "Product" ADD COLUMN "metaDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN "optionConfig" JSONB;
ALTER TABLE "Product" ADD COLUMN "variantStock" JSONB;
ALTER TABLE "Product" ADD COLUMN "stockQuantity" INTEGER;
