-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WebsiteConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT 'dev-agency',
    "previewToken" TEXT NOT NULL,
    "heroEyebrow" TEXT,
    "heroTitle" TEXT NOT NULL DEFAULT 'Découvrez nos solutions',
    "heroSubtitle" TEXT,
    "heroPrimaryCtaLabel" TEXT DEFAULT 'Demander un devis',
    "heroSecondaryCtaLabel" TEXT DEFAULT 'Télécharger la plaquette',
    "heroSecondaryCtaUrl" TEXT,
    "aboutTitle" TEXT,
    "aboutBody" TEXT,
    "contactBlurb" TEXT,
    "contactEmailOverride" TEXT,
    "contactPhoneOverride" TEXT,
    "contactAddressOverride" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "socialImageUrl" TEXT,
    "socialLinks" JSONB,
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
    "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "showInactiveProducts" BOOLEAN NOT NULL DEFAULT false,
    "featuredProductIds" JSONB,
    "leadNotificationEmail" TEXT,
    "leadAutoTag" TEXT,
    "leadThanksMessage" TEXT,
    "spamProtectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "customDomain" TEXT,
    "domainStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "domainVerificationCode" TEXT NOT NULL,
    "domainVerifiedAt" DATETIME,
    "domainActivatedAt" DATETIME,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "previewPath" TEXT NOT NULL DEFAULT 'catalogue',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebsiteConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WebsiteConfig" ("aboutBody", "aboutTitle", "accentColor", "contactAddressOverride", "contactBlurb", "contactEmailOverride", "contactPhoneOverride", "createdAt", "customDomain", "domainActivatedAt", "domainStatus", "domainVerificationCode", "domainVerifiedAt", "featuredProductIds", "heroEyebrow", "heroPrimaryCtaLabel", "heroSecondaryCtaLabel", "heroSecondaryCtaUrl", "heroSubtitle", "heroTitle", "id", "leadAutoTag", "leadNotificationEmail", "leadThanksMessage", "previewPath", "previewToken", "published", "seoDescription", "seoKeywords", "seoTitle", "showInactiveProducts", "showPrices", "slug", "socialImageUrl", "socialLinks", "spamProtectionEnabled", "theme", "updatedAt", "userId") SELECT "aboutBody", "aboutTitle", "accentColor", "contactAddressOverride", "contactBlurb", "contactEmailOverride", "contactPhoneOverride", "createdAt", "customDomain", "domainActivatedAt", "domainStatus", "domainVerificationCode", "domainVerifiedAt", "featuredProductIds", "heroEyebrow", "heroPrimaryCtaLabel", "heroSecondaryCtaLabel", "heroSecondaryCtaUrl", "heroSubtitle", "heroTitle", "id", "leadAutoTag", "leadNotificationEmail", "leadThanksMessage", "previewPath", "previewToken", "published", "seoDescription", "seoKeywords", "seoTitle", "showInactiveProducts", "showPrices", "slug", "socialImageUrl", "socialLinks", "spamProtectionEnabled", "theme", "updatedAt", "userId" FROM "WebsiteConfig";
DROP TABLE "WebsiteConfig";
ALTER TABLE "new_WebsiteConfig" RENAME TO "WebsiteConfig";
CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON "WebsiteConfig"("userId");
CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON "WebsiteConfig"("slug");
CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON "WebsiteConfig"("previewToken");
CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON "WebsiteConfig"("customDomain");
CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON "WebsiteConfig"("domainVerificationCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
