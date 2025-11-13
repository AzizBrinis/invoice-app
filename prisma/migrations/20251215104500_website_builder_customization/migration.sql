-- Add builder configuration JSON columns
ALTER TABLE "WebsiteConfig"
ADD COLUMN "builderConfig" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "builderVersionHistory" JSONB NOT NULL DEFAULT '[]';
