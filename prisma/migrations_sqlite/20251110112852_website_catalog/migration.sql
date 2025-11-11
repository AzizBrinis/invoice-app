-- CreateTable
CREATE TABLE "WebsiteConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "vatNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "leadMetadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Client" ("address", "companyName", "createdAt", "displayName", "email", "id", "isActive", "notes", "phone", "updatedAt", "userId", "vatNumber") SELECT "address", "companyName", "createdAt", "displayName", "email", "id", "isActive", "notes", "phone", "updatedAt", "userId", "vatNumber" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_userId_displayName_idx" ON "Client"("userId", "displayName");
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unité',
    "priceHTCents" INTEGER NOT NULL,
    "priceTTCCents" INTEGER NOT NULL,
    "vatRate" REAL NOT NULL,
    "defaultDiscountRate" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isListedInCatalog" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("category", "createdAt", "defaultDiscountRate", "description", "id", "isActive", "name", "priceHTCents", "priceTTCCents", "sku", "unit", "updatedAt", "userId", "vatRate") SELECT "category", "createdAt", "defaultDiscountRate", "description", "id", "isActive", "name", "priceHTCents", "priceTTCCents", "sku", "unit", "updatedAt", "userId", "vatRate" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "Product_userId_name_idx" ON "Product"("userId", "name");
CREATE UNIQUE INDEX "Product_userId_sku_key" ON "Product"("userId", "sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_userId_key" ON "WebsiteConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_slug_key" ON "WebsiteConfig"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_previewToken_key" ON "WebsiteConfig"("previewToken");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_customDomain_key" ON "WebsiteConfig"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteConfig_domainVerificationCode_key" ON "WebsiteConfig"("domainVerificationCode");
