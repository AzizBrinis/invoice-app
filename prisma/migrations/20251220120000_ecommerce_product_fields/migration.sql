-- Add product sale mode enum
CREATE TYPE "ProductSaleMode" AS ENUM ('INSTANT', 'QUOTE');

-- Add ecommerce settings to WebsiteConfig
ALTER TABLE "WebsiteConfig"
ADD COLUMN "ecommerceSettings" JSONB NOT NULL DEFAULT '{}';

-- Add ecommerce fields to Product
ALTER TABLE "Product"
ADD COLUMN "saleMode" "ProductSaleMode" NOT NULL DEFAULT 'INSTANT',
ADD COLUMN "publicSlug" TEXT,
ADD COLUMN "excerpt" TEXT,
ADD COLUMN "coverImageUrl" TEXT,
ADD COLUMN "gallery" JSONB,
ADD COLUMN "quoteFormSchema" JSONB;

-- Seed default ecommerce settings structure
UPDATE "WebsiteConfig"
SET "ecommerceSettings" = '{"payments":{"methods":{"card":false,"bankTransfer":false,"cashOnDelivery":false},"bankTransfer":{"instructions":""}},"checkout":{"requirePhone":false,"allowNotes":true,"termsUrl":""},"featuredProductIds":[]}'::jsonb
WHERE "ecommerceSettings" = '{}'::jsonb;

-- Backfill public slug values using SKU with collision safety
WITH slugged AS (
  SELECT
    id,
    "userId",
    lower(
      regexp_replace(
        regexp_replace(sku, '[^a-zA-Z0-9]+', '-', 'g'),
        '(^-+|-+$)',
        '',
        'g'
      )
    ) AS base_slug,
    row_number() OVER (
      PARTITION BY
        "userId",
        lower(
          regexp_replace(
            regexp_replace(sku, '[^a-zA-Z0-9]+', '-', 'g'),
            '(^-+|-+$)',
            '',
            'g'
          )
        )
      ORDER BY id
    ) AS rn
  FROM "Product"
)
UPDATE "Product" AS p
SET "publicSlug" = CASE
  WHEN slugged.base_slug IS NULL OR slugged.base_slug = '' THEN concat('product-', p.id)
  WHEN slugged.rn = 1 THEN slugged.base_slug
  ELSE concat(slugged.base_slug, '-', slugged.rn)
END
FROM slugged
WHERE p.id = slugged.id;

-- Enforce public slug presence and uniqueness
ALTER TABLE "Product"
ALTER COLUMN "publicSlug" SET NOT NULL;

CREATE UNIQUE INDEX "Product_userId_publicSlug_key"
ON "Product"("userId", "publicSlug");
