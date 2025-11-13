-- Add builder configuration JSON columns
ALTER TABLE "WebsiteConfig" ADD COLUMN "builderConfig" TEXT DEFAULT '{}';
ALTER TABLE "WebsiteConfig" ADD COLUMN "builderVersionHistory" TEXT DEFAULT '[]';
