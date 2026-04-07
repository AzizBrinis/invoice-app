-- Create CMS content pages for website templates
CREATE TABLE "WebsiteCmsPage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "showInFooter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteCmsPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteCmsPage_websiteId_path_key" ON "WebsiteCmsPage"("websiteId", "path");
CREATE INDEX "WebsiteCmsPage_userId_createdAt_idx" ON "WebsiteCmsPage"("userId", "createdAt");
CREATE INDEX "WebsiteCmsPage_websiteId_createdAt_idx" ON "WebsiteCmsPage"("websiteId", "createdAt");

ALTER TABLE "WebsiteCmsPage"
ADD CONSTRAINT "WebsiteCmsPage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebsiteCmsPage"
ADD CONSTRAINT "WebsiteCmsPage_websiteId_fkey"
FOREIGN KEY ("websiteId") REFERENCES "WebsiteConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
